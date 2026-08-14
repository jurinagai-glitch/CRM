import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  create table if not exists contacts (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id),
    name text not null,
    title text,
    created_at timestamptz not null default now()
  );
`);

await client.query(`
  create table if not exists deals (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id),
    name text not null,
    stage text not null default '初回接触' check (stage in ('初回接触','提案','交渉','クロージング','成約','失注')),
    amount numeric,
    expected_close_date date,
    status text not null default '進行中' check (status in ('進行中','成約','失注')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
`);

await client.query(`
  alter table meeting_notes add column if not exists raw_text text;
  alter table meeting_notes add column if not exists deal_id uuid references deals(id);
  alter table meeting_notes add column if not exists created_by text;
`);

await client.query(`
  create table if not exists meeting_summaries (
    id uuid primary key default gen_random_uuid(),
    meeting_note_id uuid not null unique references meeting_notes(id),
    summary text,
    decisions jsonb not null default '[]',
    issue text,
    budget text,
    decision_maker text,
    timeline text,
    unresolved text,
    status text not null default 'draft' check (status in ('draft','approved')),
    edited boolean not null default false,
    created_at timestamptz not null default now(),
    approved_at timestamptz
  );
`);

await client.query(`
  create table if not exists next_actions (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references companies(id),
    meeting_note_id uuid references meeting_notes(id),
    description text not null,
    assignee text,
    due_date date,
    priority text not null default '中' check (priority in ('高','中','低')),
    status text not null default 'open' check (status in ('open','done','dismissed')),
    dismiss_reason text,
    dismissed_by text,
    dismiss_snooze_until date,
    created_at timestamptz not null default now()
  );
`);

await client.query(`create index if not exists idx_next_actions_company on next_actions(company_id);`);
await client.query(`create index if not exists idx_deals_company on deals(company_id);`);
await client.query(`create index if not exists idx_contacts_company on contacts(company_id);`);

for (const t of ["contacts", "deals", "meeting_summaries", "next_actions"]) {
  await client.query(`alter table ${t} enable row level security;`);
  await client.query(`drop policy if exists ${t}_service_only on ${t};`);
  await client.query(`create policy ${t}_service_only on ${t} for all using (false) with check (false);`);
}

console.log("migration 002 complete");
await client.end();
