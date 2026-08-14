import bcrypt from "bcryptjs";
import { Router } from "express";
import { asyncHandler } from "./asyncHandler";
import {
  clearLoginFailures,
  clearSessionCookie,
  getSessionUser,
  isLoginRateLimited,
  recordLoginFailure,
  requireAuth,
  setSessionCookie,
  signSession,
  type SessionUser,
} from "./auth";
import { pool } from "./db";
import { extractFromText } from "./extraction";

export const api = Router();

api.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "メールアドレスとパスワードを入力してください" });

    const rateLimitKey = `${req.ip}:${email}`;
    if (isLoginRateLimited(rateLimitKey)) {
      return res.status(429).json({ error: "試行回数が多すぎます。しばらくしてから再度お試しください" });
    }

    const result = await pool.query("select id, email, name, role, password_hash from app_users where email = $1", [email]);
    const row = result.rows[0];
    if (!row) {
      recordLoginFailure(rateLimitKey);
      return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      recordLoginFailure(rateLimitKey);
      return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    }
    clearLoginFailures(rateLimitKey);

    const user = { id: row.id, email: row.email, name: row.name, role: row.role };
    setSessionCookie(res, signSession(user));
    res.json({ user });
  })
);

api.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

api.get("/auth/me", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "未ログインです" });
  res.json({ user });
});

const DEAL_STAGES = ["初回接触", "提案", "交渉", "クロージング", "成約", "失注"];
const DEAL_STATUSES = ["進行中", "成約", "失注"];
const ACTION_PRIORITIES = ["高", "中", "低"];
const ACTION_STATUSES = ["open", "done", "dismissed"];

api.get(
  "/companies",
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(name ilike $${params.length} or exists (select 1 from unnest(name_variants) v where v ilike $${params.length}))`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const result = await pool.query(
      `select id, name, category, name_variants, meeting_count, created_at
       from companies ${where}
       order by meeting_count desc, name asc
       limit 500`,
      params
    );
    res.json({ companies: result.rows });
  })
);

api.get(
  "/companies/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const company = await pool.query("select * from companies where id = $1", [req.params.id]);
    if (!company.rows[0]) return res.status(404).json({ error: "取引先が見つかりません" });

    const meetings = await pool.query(
      `select m.*, s.id as summary_id, s.summary, s.decisions, s.issue, s.budget, s.decision_maker, s.timeline, s.unresolved, s.status as summary_status
       from meeting_notes m
       left join meeting_summaries s on s.meeting_note_id = m.id
       where m.company_id = $1
       order by m.meeting_date desc nulls last, m.created_at desc`,
      [req.params.id]
    );
    const actions = await pool.query(
      "select * from next_actions where company_id = $1 order by due_date asc nulls last",
      [req.params.id]
    );
    const deals = await pool.query(
      "select * from deals where company_id = $1 order by created_at desc",
      [req.params.id]
    );
    const contacts = await pool.query(
      "select * from contacts where company_id = $1 order by created_at asc",
      [req.params.id]
    );
    res.json({ company: company.rows[0], meetings: meetings.rows, actions: actions.rows, deals: deals.rows, contacts: contacts.rows });
  })
);

api.post(
  "/companies/:id/deals",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, stage, amount, expected_close_date } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "商談名は必須です" });
    if (stage && !DEAL_STAGES.includes(stage)) return res.status(400).json({ error: `stageは次のいずれかにしてください: ${DEAL_STAGES.join(", ")}` });
    const result = await pool.query(
      `insert into deals (company_id, name, stage, amount, expected_close_date)
       values ($1, $2, coalesce($3, '初回接触'), $4, $5) returning *`,
      [req.params.id, name, stage || null, amount || null, expected_close_date || null]
    );
    res.json({ deal: result.rows[0] });
  })
);

api.patch(
  "/deals/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, stage, amount, expected_close_date, status } = req.body ?? {};
    if (stage && !DEAL_STAGES.includes(stage)) return res.status(400).json({ error: `stageは次のいずれかにしてください: ${DEAL_STAGES.join(", ")}` });
    if (status && !DEAL_STATUSES.includes(status)) return res.status(400).json({ error: `statusは次のいずれかにしてください: ${DEAL_STATUSES.join(", ")}` });
    const result = await pool.query(
      `update deals set
         name = coalesce($1, name), stage = coalesce($2, stage), amount = coalesce($3, amount),
         expected_close_date = coalesce($4, expected_close_date), status = coalesce($5, status)
       where id = $6 returning *`,
      [name ?? null, stage ?? null, amount ?? null, expected_close_date ?? null, status ?? null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "商談が見つかりません" });
    res.json({ deal: result.rows[0] });
  })
);

api.post(
  "/companies/:id/contacts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, title } = req.body ?? {};
    if (!name) return res.status(400).json({ error: "担当者名は必須です" });
    const result = await pool.query(
      `insert into contacts (company_id, name, title) values ($1, $2, $3) returning *`,
      [req.params.id, name, title || null]
    );
    res.json({ contact: result.rows[0] });
  })
);

api.delete(
  "/contacts/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await pool.query("delete from contacts where id = $1", [req.params.id]);
    res.json({ ok: true });
  })
);

// 議事録を貼り付け、ルールベースで下書きを生成する（下書きは meeting_summaries に status=draft で保存、
// 人が確認・保存するまで確定データ扱いにしない）
api.post(
  "/meeting-notes",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { company_id, content, meeting_date, contact } = req.body ?? {};
    if (!company_id || !content) return res.status(400).json({ error: "取引先と議事録本文は必須です" });
    const user = (req as unknown as { user: SessionUser }).user;

    const noteResult = await pool.query(
      `insert into meeting_notes (company_id, raw_text, content, meeting_date, contact, created_by)
       values ($1, $2, $2, $3, $4, $5) returning *`,
      [company_id, content, meeting_date || new Date().toISOString().slice(0, 10), contact || null, user?.name ?? user?.email ?? null]
    );
    const note = noteResult.rows[0];

    const extracted = extractFromText(content);
    const summaryResult = await pool.query(
      `insert into meeting_summaries (meeting_note_id, summary, decisions, issue, budget, decision_maker, timeline, unresolved, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft') returning *`,
      [note.id, extracted.summary, JSON.stringify(extracted.decisions), extracted.issue, extracted.budget, extracted.decision_maker, extracted.timeline, extracted.unresolved]
    );

    res.json({ meeting_note: note, summary: summaryResult.rows[0], suggested_actions: extracted.actions });
  })
);

// 人が確認・編集した内容を確定データとして反映する（下書き→承認、次アクション作成、商談件数の更新）
api.post(
  "/meeting-summaries/:id/approve",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { summary, decisions, issue, budget, decision_maker, timeline, actions } = req.body ?? {};

    const summaryRow = await pool.query("select * from meeting_summaries where id = $1", [req.params.id]);
    if (!summaryRow.rows[0]) return res.status(404).json({ error: "下書きが見つかりません" });
    const note = await pool.query("select company_id from meeting_notes where id = $1", [summaryRow.rows[0].meeting_note_id]);
    const companyId = note.rows[0]?.company_id;

    const updated = await pool.query(
      `update meeting_summaries set
         summary = $1, decisions = $2, issue = $3, budget = $4, decision_maker = $5, timeline = $6,
         status = 'approved', edited = true, approved_at = now()
       where id = $7 returning *`,
      [summary, JSON.stringify(decisions ?? []), issue, budget, decision_maker, timeline, req.params.id]
    );

    const createdActions = [];
    for (const a of actions ?? []) {
      if (!a.description) continue;
      if (a.priority && !ACTION_PRIORITIES.includes(a.priority)) continue;
      const inserted = await pool.query(
        `insert into next_actions (company_id, meeting_note_id, description, assignee, due_date, priority)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [companyId, summaryRow.rows[0].meeting_note_id, a.description, a.assignee || null, a.due_date || null, a.priority || "中"]
      );
      createdActions.push(inserted.rows[0]);
    }

    if (companyId) {
      await pool.query("update companies set meeting_count = meeting_count + 1 where id = $1", [companyId]);
    }

    res.json({ summary: updated.rows[0], actions: createdActions });
  })
);

api.get(
  "/next-actions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" && ACTION_STATUSES.includes(req.query.status) ? req.query.status : "open";
    const result = await pool.query(
      `select a.*, c.name as company_name
       from next_actions a join companies c on c.id = a.company_id
       where a.status = $1
       order by a.due_date asc nulls last, a.created_at asc`,
      [status]
    );
    res.json({ actions: result.rows });
  })
);

api.patch(
  "/next-actions/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status, dismiss_reason, dismissed_by, dismiss_snooze_until } = req.body ?? {};
    if (status && !ACTION_STATUSES.includes(status)) return res.status(400).json({ error: `statusは次のいずれかにしてください: ${ACTION_STATUSES.join(", ")}` });
    const result = await pool.query(
      `update next_actions set
         status = coalesce($1, status),
         dismiss_reason = coalesce($2, dismiss_reason),
         dismissed_by = coalesce($3, dismissed_by),
         dismiss_snooze_until = coalesce($4, dismiss_snooze_until)
       where id = $5 returning *`,
      [status ?? null, dismiss_reason ?? null, dismissed_by ?? null, dismiss_snooze_until ?? null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "次アクションが見つかりません" });
    res.json({ action: result.rows[0] });
  })
);

const INBOUND_STATUSES = ["未対応", "対応中", "取引先化済み", "対象外"];

api.get(
  "/inbound-inquiries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" && INBOUND_STATUSES.includes(req.query.status) ? req.query.status : null;
    const result = await pool.query(
      status
        ? "select * from inbound_inquiries where status = $1 order by created_at desc"
        : "select * from inbound_inquiries where status != '対象外' order by created_at desc",
      status ? [status] : []
    );
    res.json({ inquiries: result.rows });
  })
);

api.post(
  "/inbound-inquiries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { source, company_name, contact_name, content } = req.body ?? {};
    if (!company_name) return res.status(400).json({ error: "会社名は必須です" });
    const result = await pool.query(
      `insert into inbound_inquiries (source, company_name, contact_name, content)
       values ($1, $2, $3, $4) returning *`,
      [source || null, company_name, contact_name || null, content || null]
    );
    res.json({ inquiry: result.rows[0] });
  })
);

api.patch(
  "/inbound-inquiries/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status, exclusion_reason } = req.body ?? {};
    if (status && !INBOUND_STATUSES.includes(status)) return res.status(400).json({ error: `statusは次のいずれかにしてください: ${INBOUND_STATUSES.join(", ")}` });
    const result = await pool.query(
      `update inbound_inquiries set status = coalesce($1, status), exclusion_reason = coalesce($2, exclusion_reason)
       where id = $3 returning *`,
      [status ?? null, exclusion_reason ?? null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "問い合わせが見つかりません" });
    res.json({ inquiry: result.rows[0] });
  })
);

// 取引先化: 問い合わせから新しい会社を作成し、問い合わせ側を「取引先化済み」にする。
// 既存の会社名と重複していないか、事前にゆるくチェックして候補を返す（自動統合はしない）。
api.get(
  "/inbound-inquiries/:id/duplicate-check",
  requireAuth,
  asyncHandler(async (req, res) => {
    const inquiry = await pool.query("select * from inbound_inquiries where id = $1", [req.params.id]);
    if (!inquiry.rows[0]) return res.status(404).json({ error: "問い合わせが見つかりません" });
    const candidates = await pool.query(
      "select id, name, category from companies where name ilike $1 limit 10",
      [`%${inquiry.rows[0].company_name}%`]
    );
    res.json({ candidates: candidates.rows });
  })
);

api.post(
  "/inbound-inquiries/:id/convert",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { existing_company_id } = req.body ?? {};
    const inquiry = await pool.query("select * from inbound_inquiries where id = $1", [req.params.id]);
    if (!inquiry.rows[0]) return res.status(404).json({ error: "問い合わせが見つかりません" });
    if (inquiry.rows[0].status === "取引先化済み") return res.status(400).json({ error: "すでに取引先化されています" });

    let companyId = existing_company_id;
    if (!companyId) {
      const created = await pool.query(
        `insert into companies (name, category, meeting_count) values ($1, '新規開拓', 0) returning id`,
        [inquiry.rows[0].company_name]
      );
      companyId = created.rows[0].id;
    }
    if (inquiry.rows[0].contact_name) {
      await pool.query(`insert into contacts (company_id, name) values ($1, $2)`, [companyId, inquiry.rows[0].contact_name]);
    }
    const updated = await pool.query(
      `update inbound_inquiries set status = '取引先化済み', converted_company_id = $1 where id = $2 returning *`,
      [companyId, req.params.id]
    );
    res.json({ inquiry: updated.rows[0], company_id: companyId });
  })
);
