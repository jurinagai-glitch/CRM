import "dotenv/config";
import pg from "pg";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await client.connect();

// Fields the sales team actually records for an inbound inquiry.
//
// Deliberately plain text with no CHECK constraints, even for the fields that
// have a fixed picklist in the UI (product / category / action): the 2,600 rows
// of historical inquiries carry ~47 product spellings and ~22 category
// spellings, and a constraint would either block that import or force us to
// discard values we can't confidently map. New entries are validated against
// the picklists in the API instead, so the constraint lives where the clean
// data enters and history stays importable as written.
await client.query(`
  alter table inbound_inquiries add column if not exists inquiry_date date;
  alter table inbound_inquiries add column if not exists store_name text;
  alter table inbound_inquiries add column if not exists business_type text;
  alter table inbound_inquiries add column if not exists product text;
  alter table inbound_inquiries add column if not exists category text;
  alter table inbound_inquiries add column if not exists action text;
  alter table inbound_inquiries add column if not exists referred_partner text;
`);

// Historical rows are queried by date far more than by anything else.
await client.query(`create index if not exists idx_inbound_inquiry_date on inbound_inquiries(inquiry_date desc nulls last);`);

// Existing rows predate the inquiry_date column; fall back to when they were
// created so they don't all sort as "date unknown".
await client.query(`update inbound_inquiries set inquiry_date = created_at::date where inquiry_date is null;`);

console.log("009_inbound_inquiry_fields: done");
await client.end();
