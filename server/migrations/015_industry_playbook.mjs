import "dotenv/config";
import pg from "pg";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await client.connect();

// A free-text title/body/tags note is why the knowledge base sat empty: nobody
// knows what to write in an empty box. An industry playbook has named slots
// instead, so writing it is answering questions rather than composing a
// document, and two industries can be compared side by side.
await client.query(`
  alter table knowledge_items add column if not exists kind text not null default 'メモ';
  alter table knowledge_items add column if not exists business_type text;
  alter table knowledge_items add column if not exists products text[] not null default '{}';
  alter table knowledge_items add column if not exists approach text;
  alter table knowledge_items add column if not exists objections jsonb not null default '[]';
  alter table knowledge_items add column if not exists decision_process text;
  alter table knowledge_items add column if not exists price_expectation text;
  alter table knowledge_items add column if not exists competitors text;
  alter table knowledge_items add column if not exists market_status text;
`);

// Where a playbook came from. A new person has to be able to check a claim
// against the meeting it came from, and a draft written by a model must be
// visibly a draft until a person has confirmed it.
await client.query(`
  alter table knowledge_items add column if not exists source_note_ids uuid[] not null default '{}';
  alter table knowledge_items add column if not exists generated_model text;
  alter table knowledge_items add column if not exists reviewed_by text;
  alter table knowledge_items add column if not exists reviewed_at timestamptz;
`);

// One playbook per industry (products are listed inside it), so regenerating
// updates in place instead of piling up duplicates.
await client.query(`
  create unique index if not exists uq_playbook_business_type
  on knowledge_items(business_type) where kind = '業種プレイブック';
`);

console.log("015_industry_playbook: done");
await client.end();
