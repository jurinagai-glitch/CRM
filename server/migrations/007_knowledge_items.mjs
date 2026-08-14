import "dotenv/config";
import pg from "pg";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await client.connect();

await client.query(`
  create table if not exists knowledge_items (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text,
    tags text[] not null default '{}',
    source_company_id uuid references companies(id),
    source_meeting_note_id uuid references meeting_notes(id),
    created_by text,
    created_at timestamptz not null default now()
  );
`);

await client.query(`create index if not exists idx_knowledge_items_company on knowledge_items(source_company_id);`);
await client.query(`create index if not exists idx_knowledge_items_tags on knowledge_items using gin(tags);`);

await client.query(`alter table knowledge_items enable row level security;`);
await client.query(`drop policy if exists knowledge_items_service_only on knowledge_items;`);
await client.query(`create policy knowledge_items_service_only on knowledge_items for all using (false) with check (false);`);

console.log("migration 007 complete");
await client.end();
