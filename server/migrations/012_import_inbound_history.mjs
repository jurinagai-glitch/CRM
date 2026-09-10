/**
 * One-off import of the historical inbound inquiries from the team's
 * spreadsheet ("法人書籍事業業務メモ (1).xlsx" → sheet "INbound状況", 2,602 rows).
 *
 * Normalization rules were confirmed with the user:
 *  - 代理店 / 共同事業者候補 → 共同事業者 (the terminology changed; they are the same thing)
 *  - ビューン@ / ビューン＠ / ＠ / @ are all the same product
 *  - a row naming several products becomes several products (the column is a list)
 *  - a name containing 株式会社 etc. goes to 社名, anything else goes to 店名
 *  - 業態 is folded into the 8 agreed categories, by meaning, with anything that
 *    doesn't fit going to その他
 *  - アクション is only set to 紹介 where the sheet names a partner; it is left
 *    blank otherwise rather than assumed to be 直販
 *
 * Re-runnable: rows are keyed on (source='Excel取込', inquiry_date, name) and
 * cleared before inserting, so a second run does not duplicate.
 */
import "dotenv/config";
import pg from "pg";
import xlsx from "xlsx";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const SHEET_PATH = process.argv[2] || "../法人書籍事業業務メモ (1).xlsx";
const DRY_RUN = process.argv.includes("--dry-run");
const IMPORT_SOURCE = "Excel取込";

// --- normalization ---------------------------------------------------------

const CORP = /(株式会社|㈱|\(株\)|（株）|有限会社|㈲|有\）|\(有\)|（有）|合同会社|合資会社|一般社団法人|一般財団法人|医療法人|社会福祉法人|学校法人|宗教法人|公益財団法人|公益社団法人|財団法人|社団法人|独立行政法人|生活協同組合|協同組合|Inc\.|LLC|Co\.,? ?Ltd)/;

function splitName(rawName) {
  const name = String(rawName).replace(/\s+/g, " ").trim();
  if (!CORP.test(name)) return { company: null, store: name };

  const tokens = name.split(" ").filter(Boolean);
  const markerIndex = tokens.findIndex((t) => CORP.test(t));
  if (markerIndex === -1 || tokens.length === 1) return { company: name, store: null };

  // A prefix-form marker ("株式会社サンシャイン ジャンボおもろ店") ends the company
  // name at that token; a suffix-form one ("ダイハツ広島販売株式会社 ◯◯店")
  // includes everything up to it.
  const company = tokens.slice(0, markerIndex + 1).join(" ");
  const store = tokens.slice(markerIndex + 1).join(" ") || null;
  return { company, store };
}

const PRODUCT_RULES = [
  [/スポット\s*[+＋]|スポットプラス/, "スポット＋"],
  [/スポット/, "スポット"],
  [/タブレット/, "タブレット"],
  [/マンション/, "マンション"],
  [/ビューン\s*[@＠]|^\s*[@＠]\s*$|ビューンアット/, "ビューン@"],
];

function normalizeProducts(raw) {
  if (raw == null) return [];
  const parts = String(raw).split(/[\n\r、,／/・]+/).map((p) => p.trim()).filter(Boolean);
  const out = new Set();
  for (const part of parts) {
    const hit = PRODUCT_RULES.find(([re]) => re.test(part));
    // Anything that names something real but isn't one of the five products
    // (業務提携 etc.) is still an inquiry about something — record it as その他.
    out.add(hit ? hit[1] : "その他");
  }
  // Sort to the picklist's own order so "スポット+タブレット" and
  // "タブレット+スポット" don't read as two different combinations in reports.
  const ORDER = ["スポット", "スポット＋", "タブレット", "マンション", "ビューン@", "その他"];
  return [...out].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

function normalizeCategory(raw) {
  const v = raw == null ? "" : String(raw).trim();
  if (!v) return null;
  if (/店舗・代理店|店舗\/代理店/.test(v)) return "その他"; // genuinely both — don't guess
  if (/代理店|共同事業者/.test(v)) return "共同事業者";
  if (/店舗/.test(v)) return "店舗";
  return "その他";
}

// Ordered: the first match wins, so narrower rules come before broader ones.
// 自動車学校 must not fall into カーディーラー, so car sales is matched on
// 販売/ディーラー rather than on 自動車 alone.
const BUSINESS_RULES = [
  [/パチンコ|スロット|遊技|ホール/, "パチンコ"],
  [/病院|クリニック|医院|医療|歯科|眼科|内科|外科|皮膚科|産婦人科|小児科|整形|接骨|整骨|鍼灸|薬局|健診|検診|診療|療院|助産|動物病院|獣医/, "病院・クリニック"],
  [/ホテル|旅館|宿|ペンション|民宿|リゾート/, "ホテル"],
  [/カーディーラー|ディーラー|自動車販売|車販売|中古車|カー用品|モータース|自動車商/, "カーディーラー"],
  [/美容|理容|理髪|ヘアサロン|ヘア|サロン|エステ|ネイル|まつげ|マツエク|バーバー/, "美容室"],
  [/管理会社|不動産|マンション|アパート|大家|オーナー|賃貸|ビル管理|管理組合|デベロッパー/, "管理会社"],
  [/福利厚生|労働組合|組合|従業員|社員|企業|オフィス|会社/, "福利厚生"],
];

function normalizeBusinessType(raw) {
  const v = raw == null ? "" : String(raw).trim();
  if (!v || /^(不明|未定|-|―|なし)$/.test(v)) return null;
  const hit = BUSINESS_RULES.find(([re]) => re.test(v));
  return hit ? hit[1] : "その他";
}

// "春" and "春うららかな書房" are the same partner; the sheet uses both.
const PARTNER_ALIASES = new Map([
  ["春", "春うららかな書房"],
  ["ホスピタルネット", "株式会社ホスピタルネット"],
]);

function normalizePartner(raw) {
  const v = raw == null ? "" : String(raw).trim();
  if (!v || /^(-|―|なし|未定)$/.test(v)) return null;
  return PARTNER_ALIASES.get(v) || v;
}

// Excel serial → ISO date. The sheet contains at least one corrupt serial that
// decodes to 1934, so anything outside a plausible business range is dropped
// rather than imported as a wrong date.
function excelDate(serial) {
  if (typeof serial !== "number" || !Number.isFinite(serial)) return null;
  if (serial < 36526 || serial > 55000) return null; // 2000-01-01 .. ~2050
  return new Date(Date.UTC(1899, 11, 30 + Math.floor(serial))).toISOString().slice(0, 10);
}

function mapStatus(situation, final) {
  const s = `${situation ?? ""} ${final ?? ""}`.trim();
  if (/成約|受注/.test(s)) return "取引先化済み";
  if (/失注|終了|対象外|見送/.test(s)) return "対象外";
  // A row the team clearly worked (紹介済 / 紹介-完了 / 営業-打診 …) shouldn't come
  // back as 未対応; only rows with no recorded progress at all do.
  if (s) return "対応中";
  return "未対応";
}

// --- run -------------------------------------------------------------------

const wb = xlsx.readFile(SHEET_PATH);
const sheet = wb.Sheets["INbound状況"];
if (!sheet) throw new Error('sheet "INbound状況" not found');

const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null }).slice(1).filter((r) => r[3]);
const COL = { date: 1, name: 3, business: 4, product: 5, category: 6, situation: 11, final: 12, partner: 13 };

const prepared = rows.map((r) => {
  const { company, store } = splitName(r[COL.name]);
  const partner = normalizePartner(r[COL.partner]);
  const original = [r[COL.situation], r[COL.final]].filter(Boolean).join(" / ") || null;
  return {
    inquiry_date: excelDate(r[COL.date]),
    company_name: company,
    store_name: store,
    business_type: normalizeBusinessType(r[COL.business]),
    products: normalizeProducts(r[COL.product]),
    category: normalizeCategory(r[COL.category]),
    // Only the rows that actually name a partner are referrals.
    action: partner ? "紹介" : null,
    referred_partner: partner,
    status: mapStatus(r[COL.situation], r[COL.final]),
    original_status: original,
  };
});

const summarize = (key) => {
  const m = new Map();
  prepared.forEach((p) => {
    const v = Array.isArray(p[key]) ? (p[key].join("+") || "(なし)") : (p[key] ?? "(なし)");
    m.set(v, (m.get(v) || 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" / ");
};

console.log("取込対象:", prepared.length, "件");
console.log("\n業態     :", summarize("business_type"));
console.log("\n商材     :", summarize("products"));
console.log("\n区分     :", summarize("category"));
console.log("\nアクション:", summarize("action"));
console.log("\nステータス:", summarize("status"));
console.log("\n紹介先   :", summarize("referred_partner").slice(0, 400));
console.log("\n社名なし(店名のみ):", prepared.filter((p) => !p.company_name).length);
console.log("日付なし:", prepared.filter((p) => !p.inquiry_date).length);
console.log("\n先頭3件:", JSON.stringify(prepared.slice(0, 3), null, 1));

if (DRY_RUN) {
  console.log("\n[dry-run] データベースには書き込みませんでした");
  process.exit(0);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await client.connect();
try {
  await client.query("BEGIN");
  const cleared = await client.query("delete from inbound_inquiries where source = $1", [IMPORT_SOURCE]);
  for (const p of prepared) {
    await client.query(
      `insert into inbound_inquiries
         (source, is_historical, inquiry_date, company_name, store_name, business_type,
          products, category, action, referred_partner, status, original_status)
       values ($1, true, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        IMPORT_SOURCE, p.inquiry_date, p.company_name, p.store_name, p.business_type,
        p.products, p.category, p.action, p.referred_partner, p.status, p.original_status,
      ]
    );
  }
  await client.query("COMMIT");
  console.log(`\n完了: ${prepared.length}件を取込（再実行時の重複防止で${cleared.rowCount}件を先に削除）`);
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  await client.end();
}
