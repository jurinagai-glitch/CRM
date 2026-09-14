/**
 * Draft an industry playbook from that industry's own meeting notes.
 *
 *   node server/migrations/016_generate_playbook.mjs カーディーラー [--dry-run]
 *
 * Two passes, because the free tier's per-minute token budget can't take a whole
 * industry's notes in one request, and because asking for a synthesis over 75
 * notes in one shot produces vague generalities:
 *   1. read the notes in chunks and pull out only what was literally said —
 *      objections, angles that worked, prices, competitors, who decided;
 *   2. fold those observations into one playbook.
 *
 * Partner companies (共同事業者) are excluded from the source notes: their
 * meetings are about reselling, not about buying, and mixing them in would
 * describe the wrong conversation.
 *
 * Output is stored as a draft — reviewed_at stays null until a person confirms
 * it in the app. Nothing here is presented as established fact on its own.
 */
import "dotenv/config";
import pg from "pg";
import OpenAI from "openai";
import { SUPABASE_CA } from "./_dbConfig.mjs";
const EXCLUSIVE_TERRITORIES = [
  { businessType: "美容室", partner: "春うららかな書房", note: "独占開拓権を付与済み。自社では開拓せず、問い合わせは春うららかな書房へ紹介する。" },
  { businessType: "マンガ喫茶", partner: "春うららかな書房", note: "独占開拓権を付与済み。自社では開拓せず、問い合わせは春うららかな書房へ紹介する。" },
];

const BUSINESS_TYPE = process.argv[2];
const DRY_RUN = process.argv.includes("--dry-run");
if (!BUSINESS_TYPE) {
  console.error("使い方: node 016_generate_playbook.mjs <業種> [--dry-run]");
  process.exit(1);
}

const CHUNK_CHARS = 3000; // keeps each request inside the free tier's TPM budget
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await db.connect();

const notes = await db.query(
  `select m.id, co.name, m.meeting_date, m.content
   from companies co join meeting_notes m on m.company_id = co.id
   where co.business_type = $1 and m.content is not null and length(m.content) > 50
   order by m.meeting_date desc nulls last`,
  [BUSINESS_TYPE]
);
if (notes.rows.length === 0) {
  console.error(`「${BUSINESS_TYPE}」の商談記録が見つかりません`);
  process.exit(1);
}
console.log(`材料: ${notes.rows.length}件 / ${notes.rows.reduce((s, r) => s + r.content.length, 0)}文字`);

const llm = new OpenAI({
  apiKey: process.env.EXTRACTION_API_KEY,
  baseURL: process.env.EXTRACTION_BASE_URL || "https://api.groq.com/openai/v1",
});
const MODEL = process.env.EXTRACTION_MODEL || "qwen/qwen3.8-27b";

async function ask(system, user, maxTokens = 900) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await llm.chat.completions.create({
        model: MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      });
      const raw = res.choices[0].message.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      return JSON.parse(raw);
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(/rate|429/i.test(String(err.message)) ? 25000 : 4000);
    }
  }
}

// --- pass 1: what was actually said ----------------------------------------
const PASS1_SYSTEM = `あなたは法人向け読み放題サービスの営業記録を分析する担当者です。
渡された商談記録から、**実際に書かれている事実だけ**を抜き出してください。

抽出する項目:
- objections: 顧客が言った断り文句・懸念（原文の表現を活かす）
- worked: 反応が良かった提案の切り口・成功した進め方
- prices: 金額・料金・費用に関する具体的な記述
- competitors: **本サービスと比較検討されている他社サービス**の社名・サービス名。
  注意: 顧客自身の社名やその取扱ブランド（トヨタ・ダイハツ・スバル等の自動車メーカー名など）は
  競合ではない。比較・検討・併用の対象として挙がっているものだけを書くこと。
- deciders: 誰が決裁したか・どういう承認プロセスか

ルール:
- 記録にないことは絶対に書かない。推測・一般論を混ぜない。
- 該当がない項目は空配列にする。
- 各要素は簡潔に（1文程度）。日本語のみ。
出力は次のJSONのみ:
{"objections":[],"worked":[],"prices":[],"competitors":[],"deciders":[]}`;

const chunks = [];
let buf = [];
let bufLen = 0;
for (const n of notes.rows) {
  const text = `【${n.name}】${String(n.content).replace(/\s+/g, " ")}`;
  if (bufLen + text.length > CHUNK_CHARS && buf.length) {
    chunks.push(buf);
    buf = [];
    bufLen = 0;
  }
  buf.push(text);
  bufLen += text.length;
}
if (buf.length) chunks.push(buf);
console.log(`${chunks.length}チャンクに分割して観察を抽出します`);

// Pass 1 costs ~90s of rate-limited calls, and pass 2's wording usually needs a
// few attempts to get right. Caching the observations makes that iteration cheap
// (--reuse skips straight to pass 2).
const CACHE = `${process.env.TEMP || "/tmp"}/playbook-observations-${BUSINESS_TYPE}.json`;
const fs = await import("node:fs");

let observed = { objections: [], worked: [], prices: [], competitors: [], deciders: [] };
if (process.argv.includes("--reuse") && fs.existsSync(CACHE)) {
  observed = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  console.log("キャッシュした観察を再利用します");
  chunks.length = 0;
}
for (let i = 0; i < chunks.length; i++) {
  const result = await ask(PASS1_SYSTEM, chunks[i].join("\n\n"));
  for (const key of Object.keys(observed)) {
    for (const item of result?.[key] ?? []) {
      if (typeof item === "string" && item.trim()) observed[key].push(item.trim());
    }
  }
  process.stdout.write(`\r抽出中 ${i + 1}/${chunks.length}`);
  await sleep(9000);
}
if (chunks.length) fs.writeFileSync(CACHE, JSON.stringify(observed));
console.log("\n観察件数:", Object.fromEntries(Object.entries(observed).map(([k, v]) => [k, v.length])));

// --- pass 2: fold into one playbook ----------------------------------------
const exclusive = EXCLUSIVE_TERRITORIES.find((t) => t.businessType === BUSINESS_TYPE);
const PASS2_SYSTEM = `あなたは営業チームの教育担当です。実際の商談から集めた観察メモをもとに、
新しく入った営業担当者が「${BUSINESS_TYPE}」に提案する前に読むプレイブックを作ります。

ルール:
- 観察メモに書かれている内容だけを使う。一般論や推測を足さない。
- 具体的な金額・社名・数字は省略せずそのまま活かす。
- competitors には、本サービスと**比較検討された他社サービスだけ**を書く。
  顧客の取扱ブランドや顧客自身の社名（自動車メーカー名など）を競合として書いてはいけない。

【objections の作り方】これが最も重要な項目です。
- **似た断り文句は1つにまとめること。** 例えば「利用者が少ない」「1日1〜2人しか見ない」
  「思ったより少なかった」は全て同じ趣旨なので、代表的な1件に統合する。
- **5〜7件に絞る。** 頻出するもの・商談が止まった原因になったものを優先する。
  列挙ではなく、新人が備えるべき代表例を選ぶこと。
- **response は必ず埋める努力をすること。** worked（反応が良かった進め方）の中から、
  その断り文句への対処として使えるものを選んで書く。
  直接対応する成功事例がなくても、worked にある近い打ち手を応用して書いてよい。
  どうしても材料がない場合のみ空文字にする。
- 日本語のみ。簡潔に書く。
出力は次のJSONのみ:
{"approach":"刺さる切り口（3〜5行）","objections":[{"objection":"","response":""}],
"decision_process":"決裁の通り方","price_expectation":"相場観・価格の実態",
"competitors":"競合の状況","market_status":"この業種の現状（1〜3行）"}`;

const payload = Object.entries(observed)
  .map(([k, v]) => `## ${k}\n${[...new Set(v)].slice(0, 40).map((x) => `- ${x}`).join("\n")}`)
  .join("\n\n");

const playbook = await ask(PASS2_SYSTEM, payload, 1500);

const summary = {
  business_type: BUSINESS_TYPE,
  ...playbook,
  exclusive: exclusive ? `${exclusive.partner}の独占領域: ${exclusive.note}` : null,
  source_notes: notes.rows.length,
};
console.log("\n--- 生成結果 ---");
console.log(JSON.stringify(summary, null, 2));

if (DRY_RUN) {
  console.log("\n[dry-run] 保存しませんでした");
  await db.end();
  process.exit(0);
}

const title = `${BUSINESS_TYPE}への提案プレイブック`;
const body = exclusive
  ? `※${exclusive.partner}の独占領域です。${exclusive.note}`
  : null;

await db.query(
  `insert into knowledge_items
     (kind, title, body, business_type, approach, objections, decision_process,
      price_expectation, competitors, market_status, source_note_ids, generated_model, created_by, tags)
   values ('業種プレイブック', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'AI下書き', $12)
   on conflict (business_type) where kind = '業種プレイブック'
   do update set title = excluded.title, body = excluded.body, approach = excluded.approach,
     objections = excluded.objections, decision_process = excluded.decision_process,
     price_expectation = excluded.price_expectation, competitors = excluded.competitors,
     market_status = excluded.market_status, source_note_ids = excluded.source_note_ids,
     generated_model = excluded.generated_model,
     -- a regenerated draft needs reviewing again
     reviewed_by = null, reviewed_at = null`,
  [
    title, body, BUSINESS_TYPE, playbook.approach ?? null,
    JSON.stringify(playbook.objections ?? []), playbook.decision_process ?? null,
    playbook.price_expectation ?? null, playbook.competitors ?? null, playbook.market_status ?? null,
    notes.rows.map((n) => n.id), MODEL, [BUSINESS_TYPE],
  ]
);
console.log(`\n保存しました（未レビューの下書きとして）`);
await db.end();
