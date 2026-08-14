import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// deals/contacts tables already exist from migration 002; this migration only
// adds what was missing for the API to query them efficiently and keep
// updated_at accurate.
await client.query(`
  create or replace function set_updated_at() returns trigger as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$ language plpgsql;
`);
await client.query(`drop trigger if exists deals_set_updated_at on deals;`);
await client.query(`
  create trigger deals_set_updated_at before update on deals
  for each row execute function set_updated_at();
`);

console.log("migration 003 complete");
await client.end();
