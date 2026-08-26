import "dotenv/config";
import pg from "pg";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await client.connect();

// Task-board tasks should be creatable with a free-typed company name (not
// necessarily a registered company) or no company at all — company_id can no
// longer be required, and company_name_text holds the free-text case.
await client.query(`
  alter table next_actions alter column company_id drop not null;
  alter table next_actions add column if not exists company_name_text text;
`);

console.log("008_next_actions_freetext_company: done");
await client.end();
