import "dotenv/config";
import pg from "pg";
import { SUPABASE_CA } from "./_dbConfig.mjs";

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
});

async function main() {
  await client.connect();

  // Lets /meeting-summaries/:id/approve be safely retried: each generated
  // next_action is tied to its source summary + position, so a duplicate
  // approve request can't insert the same action twice.
  await client.query(`
    alter table next_actions add column if not exists source_summary_id uuid references meeting_summaries(id);
    alter table next_actions add column if not exists source_action_index int;
    create unique index if not exists uq_next_actions_source
      on next_actions(source_summary_id, source_action_index)
      where source_summary_id is not null;
  `);

  // approved_by / dismissed_by_user_id record who actually performed the
  // action via their authenticated session, instead of trusting a client-sent
  // name string.
  await client.query(`
    alter table meeting_summaries add column if not exists approved_by uuid references app_users(id);
    alter table next_actions add column if not exists dismissed_by_user_id uuid references app_users(id);
  `);

  // Inbound inquiry conversion should also create a deal (matches the UI copy
  // "取引先と商談を作成"); this column lets the API return/reference it.
  await client.query(`
    alter table inbound_inquiries add column if not exists converted_deal_id uuid references deals(id);
  `);

  console.log("006_audit_and_idempotency: done");
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  await client.end();
  process.exit(1);
});
