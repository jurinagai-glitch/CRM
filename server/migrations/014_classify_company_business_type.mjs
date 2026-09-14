/**
 * Assign a business type to every company, so meeting notes can be grouped by
 * industry for the knowledge layer.
 *
 * Hybrid on purpose — inference is the last resort, not the first:
 *   1. 既存代理店 are already marked 共同事業者 by migration 013 and are never
 *      re-examined. They are partners, not end customers; letting a model guess
 *      "this partner is a 美容室" would poison the industry knowledge.
 *   2. The imported inquiry archive already records a real, human-entered
 *      industry for some of these companies — matched by normalized name.
 *   3. Obvious names (◯◯歯科, ◯◯ホテル) are matched by rule.
 *   4. Only what remains goes to the LLM, reading that company's own meeting
 *      notes. Groq's free tier is rate limited, so this batches and backs off.
 *
 * Re-runnable: only rows where business_type is null are touched, so a manual
 * correction is never overwritten. Pass --dry-run to preview, --limit=N to cap.
 */
import "dotenv/config";
import pg from "pg";
import OpenAI from "openai";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || Infinity;

export const BUSINESS_TYPES = [
  "ホテル", "病院・クリニック", "カーディーラー", "美容室", "マンガ喫茶",
  "福利厚生", "管理会社", "パチンコ", "その他",
];

// Same meaning-based folding used when importing the inquiry archive, so both
// datasets land in the same buckets. Order matters: narrower rules first.
// 自動車学校 must not read as カーディーラー, so car sales matches 販売/ディーラー.
const NAME_RULES = [
  [/パチンコ|スロット|遊技/, "パチンコ"],
  [/漫画喫茶|まんが喫茶|マンガ喫茶|ネットカフェ|コミック|まんが|複合カフェ/, "マンガ喫茶"],
  [/病院|クリニック|医院|歯科|眼科|内科|外科|皮膚科|産婦人科|小児科|整形|接骨|整骨|鍼灸|薬局|健診|検診|診療|医療法人|療院|動物病院|獣医/, "病院・クリニック"],
  [/ホテル|旅館|リゾート|温泉|湯|宿坊|ペンション/, "ホテル"],
  [/カーディーラー|ディーラー|自動車販売|モータース|中古車|オート|カー用品/, "カーディーラー"],
  [/美容室|美容院|ヘアサロン|ヘアー|理容|理髪|サロン|エステ|ネイル|バーバー/, "美容室"],
  [/管理会社|不動産|マンション|アパート|ハウス|住宅|地所|ビル管理|管理組合/, "管理会社"],
];

function byName(name) {
  const hit = NAME_RULES.find(([re]) => re.test(name));
  return hit ? hit[1] : null;
}

// 共同事業者 is offered as an answer because the source data mislabels some
// partners as 新規開拓: companies like ITX or ジャリア read as prospects by
// category but their meeting notes show them selling our service to their own
// customers. Filing those under an end-customer industry would mix partner
// meetings into the industry knowledge, which is exactly what must not happen.
const SYSTEM_PROMPT = `あなたは法人向けサービス（雑誌・書籍の読み放題）の営業データを整理する担当者です。
商談記録を読み、その取引先の「業態」を次の中から1つだけ選んでください。

${BUSINESS_TYPES.join(" / ")} / 共同事業者

判定のルール:
- 商談記録に書かれている事実だけで判断すること。推測で決めない。
- 判断できる材料がない場合は必ず "不明" と答えること。無理に当てはめない。
- **その会社が自社の顧客へ本サービスを販売・紹介している場合は「共同事業者」**とすること。
  （例:「◯◯店へヒアリングしていただいている」「取扱店舗を増やす」「代理店として」
  「営業パートナー」「提案していただく」「プレ営業」「MG（ミニマムギャランティ）」など、
  その会社自身が売り手として動いている記述がある場合）
- **最重要**: 商談記録に業態名が出てきても、それがその会社の「販売先」なら、その業態を選んではいけない。
  必ず「共同事業者」とすること。
  誤答例: 「パチンコ店へヒアリングを行っていただいている」→ これは販売先がパチンコ店という意味であり、
  この会社自体はパチンコ店ではない。正解は「共同事業者」であって「パチンコ」ではない。
  見分け方: 「〜していただく」「〜へ提案」「〜を開拓」と書かれていれば、その業態は顧客の顧客である。
- 逆に、その会社が自社の施設・従業員のために導入を検討している場合は、その施設の業態を選ぶ。
  （例:「自店舗で利用者が伸びなかった」「スタッフが使い方に慣れない」→ その施設の業態）
- 「福利厚生」は、一般企業・労働組合・自治体などが従業員向けに検討している場合に使う。
- 出力は必ず次の形式のJSONのみ。説明文は書かない。
{"results":[{"index":0,"business_type":"ホテル"},{"index":1,"business_type":"不明"}]}`;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await client.connect();

// --- step 1: inherit the human-entered industry from the inquiry archive -----
const inherited = DRY_RUN ? { rowCount: 0 } : await client.query(`
  with norm as (
    select id, regexp_replace(name, '(株式会社|㈱|有限会社|㈲|\\(株\\)|（株）|合同会社|\\s)', '', 'g') as k
    from companies where business_type is null
  ), inq as (
    select distinct on (k) k, business_type from (
      select regexp_replace(coalesce(company_name, store_name), '(株式会社|㈱|有限会社|㈲|\\(株\\)|（株）|合同会社|\\s)', '', 'g') as k,
             business_type
      from inbound_inquiries
      where is_historical and business_type is not null and business_type <> 'その他'
    ) s order by k
  )
  update companies c set business_type = inq.business_type, business_type_source = '問い合わせ履歴から'
  from norm n join inq on inq.k = n.k
  where c.id = n.id
  returning c.id`);
console.log(`問い合わせ履歴から確定: ${inherited.rowCount}社`);

// --- step 2: unambiguous company names --------------------------------------
const unnamed = await client.query(`select id, name from companies where business_type is null`);
let byNameCount = 0;
for (const row of unnamed.rows) {
  const t = byName(row.name);
  if (!t) continue;
  byNameCount++;
  if (!DRY_RUN) {
    await client.query(`update companies set business_type = $1, business_type_source = '社名から' where id = $2`, [t, row.id]);
  }
}
console.log(`社名から確定: ${byNameCount}社`);

// --- step 3: infer the rest from their own meeting notes --------------------
const remaining = await client.query(`
  select c.id, c.name,
         (select string_agg(left(m.content, 600), E'\\n---\\n' order by m.meeting_date desc nulls last)
          from (select * from meeting_notes mm where mm.company_id = c.id
                order by mm.meeting_date desc nulls last limit 3) m) as notes
  from companies c
  where c.business_type is null
  order by c.meeting_count desc`);

const targets = remaining.rows.filter((r) => r.notes && r.notes.trim()).slice(0, LIMIT);
const noMaterial = remaining.rows.length - remaining.rows.filter((r) => r.notes && r.notes.trim()).length;
console.log(`AI判定の対象: ${targets.length}社（商談記録なしで判定不可: ${noMaterial}社）`);

if (DRY_RUN) {
  console.log("\n[dry-run] 書き込みは行いません。AI判定対象の先頭3社:");
  targets.slice(0, 3).forEach((t) => console.log(` - ${t.name}: ${String(t.notes).slice(0, 100).replace(/\n/g, " ")}…`));
  await client.end();
  process.exit(0);
}

const llm = new OpenAI({
  apiKey: process.env.EXTRACTION_API_KEY,
  baseURL: process.env.EXTRACTION_BASE_URL || "https://api.groq.com/openai/v1",
});
const MODEL = process.env.EXTRACTION_MODEL || "qwen/qwen3.8-27b";
const BATCH = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let decided = 0, unknown = 0, failed = 0;
for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH);
  const payload = batch
    .map((b, idx) => `[${idx}] 取引先名: ${b.name}\n商談記録: ${String(b.notes).replace(/\s+/g, " ").slice(0, 700)}`)
    .join("\n\n");

  let parsed = null;
  for (let attempt = 0; attempt < 4 && !parsed; attempt++) {
    try {
      const res = await llm.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `次の${batch.length}社の業態を判定してください。\n\n${payload}` },
        ],
        max_tokens: 700,
        response_format: { type: "json_object" },
      });
      parsed = JSON.parse(res.choices[0].message.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    } catch (err) {
      const wait = /rate|429/i.test(String(err.message)) ? 20000 : 3000;
      if (attempt === 3) { failed += batch.length; break; }
      await sleep(wait);
    }
  }

  for (const r of parsed?.results ?? []) {
    const target = batch[r.index];
    if (!target) continue;
    // Anything the model wasn't sure about, or answered outside the list, is
    // left null rather than forced into a bucket — a wrong industry is worse
    // than a missing one for knowledge grouping.
    if (![...BUSINESS_TYPES, "共同事業者"].includes(r.business_type)) { unknown++; continue; }
    await client.query(
      `update companies set business_type = $1, business_type_source = 'AI判定' where id = $2 and business_type is null`,
      [r.business_type, target.id]
    );
    decided++;
  }
  process.stdout.write(`\r判定中 ${Math.min(i + BATCH, targets.length)}/${targets.length}（確定${decided} 不明${unknown} 失敗${failed}）`);
  await sleep(9000); // stay inside the free tier's per-minute token budget
}

console.log(`\n\nAI判定: 確定${decided}社 / 不明のまま${unknown}社 / 失敗${failed}社`);
const final = await client.query(`
  select coalesce(business_type, '(未判定)') as 業態, business_type_source as 判定方法, count(*)::int as 社数
  from companies group by 1, 2 order by 社数 desc`);
console.table(final.rows);
await client.end();
