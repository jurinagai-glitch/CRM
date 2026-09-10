import "dotenv/config";
import pg from "pg";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await client.connect();

// 1,240 of the 2,602 historical inquiries are recorded only by a store name
// ("コミックバスター市ヶ谷店"), with no corporate entity at all. The rule is that
// a name carrying 株式会社 etc. goes to the company field and anything else goes
// to the store field — so a company name cannot be required.
await client.query(`alter table inbound_inquiries alter column company_name drop not null;`);

// Historical rows are a reference archive, not today's queue. Without this flag
// the triage list would open with ~2,300 inquiries from previous years sitting
// in 未対応, which would make the screen useless for its actual job.
await client.query(`alter table inbound_inquiries add column if not exists is_historical boolean not null default false;`);

// The spreadsheet's own progress wording (紹介済 / 紹介-完了 / 成約 / 失注 / 受注 …)
// is finer-grained than this app's four statuses; keep the original text so the
// import is not a lossy one-way mapping.
await client.query(`alter table inbound_inquiries add column if not exists original_status text;`);

await client.query(`create index if not exists idx_inbound_historical on inbound_inquiries(is_historical);`);

console.log("011_inquiry_history: done");
await client.end();
