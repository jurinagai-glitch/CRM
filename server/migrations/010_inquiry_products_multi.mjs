import "dotenv/config";
import pg from "pg";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});
await client.connect();

// An inquiry can be about more than one product — the historical sheet has rows
// like "スポット / タブレット" — so this is a list, not a single value.
await client.query(`alter table inbound_inquiries add column if not exists products text[] not null default '{}';`);

// Carry over anything already recorded in the single-value column before it goes.
await client.query(`
  update inbound_inquiries
  set products = array[product]
  where product is not null and btrim(product) <> '' and products = '{}';
`);
await client.query(`alter table inbound_inquiries drop column if exists product;`);

// Reporting groups inquiries by product, and a list column needs GIN for that.
await client.query(`create index if not exists idx_inbound_products on inbound_inquiries using gin(products);`);

console.log("010_inquiry_products_multi: done");
await client.end();
