import "dotenv/config";
import pg from "pg";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await client.connect();

// Knowledge is organised by industry, but industry currently only exists on the
// imported inquiry archive — only 91 of 1,095 meeting notes can be attributed to
// one. Putting it on the company makes every meeting note attributable.
await client.query(`alter table companies add column if not exists business_type text;`);

// How the value was arrived at, so a hand correction is never silently
// overwritten by a re-run, and so an AI guess is visibly distinguishable from a
// known fact.
await client.query(`alter table companies add column if not exists business_type_source text;`);

await client.query(`create index if not exists idx_companies_business_type on companies(business_type);`);

// 既存代理店 are partners (共同事業者), not end customers. Classifying them by
// end-customer industry would mix partner meetings into the industry knowledge
// and corrupt it, so they are marked explicitly and never sent for inference.
const partners = await client.query(`
  update companies set business_type = '共同事業者', business_type_source = '区分から確定'
  where category like '既存代理店%' and business_type is null
  returning id`);

console.log(`013_company_business_type: done (共同事業者として確定: ${partners.rowCount}社)`);
await client.end();
