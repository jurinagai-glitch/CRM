import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  create table if not exists inbound_inquiries (
    id uuid primary key default gen_random_uuid(),
    source text,
    company_name text not null,
    contact_name text,
    content text,
    status text not null default '未対応' check (status in ('未対応','対応中','取引先化済み','対象外')),
    converted_company_id uuid references companies(id),
    exclusion_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
`);

await client.query(`drop trigger if exists inbound_inquiries_set_updated_at on inbound_inquiries;`);
await client.query(`
  create trigger inbound_inquiries_set_updated_at before update on inbound_inquiries
  for each row execute function set_updated_at();
`);

await client.query(`create index if not exists idx_inbound_status on inbound_inquiries(status);`);

await client.query(`alter table inbound_inquiries enable row level security;`);
await client.query(`drop policy if exists inbound_inquiries_service_only on inbound_inquiries;`);
await client.query(`create policy inbound_inquiries_service_only on inbound_inquiries for all using (false) with check (false);`);

console.log("migration 004 complete");
await client.end();
