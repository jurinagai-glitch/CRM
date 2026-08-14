import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  create table if not exists proposals (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id),
    deal_id uuid references deals(id),
    type text not null default '提案書' check (type in ('提案書','見積書','契約書','その他')),
    title text not null,
    url text not null,
    version int not null default 1,
    created_by text,
    created_at timestamptz not null default now()
  );
`);

await client.query(`create index if not exists idx_proposals_company on proposals(company_id);`);

await client.query(`alter table proposals enable row level security;`);
await client.query(`drop policy if exists proposals_service_only on proposals;`);
await client.query(`create policy proposals_service_only on proposals for all using (false) with check (false);`);

console.log("migration 005 complete");
await client.end();
