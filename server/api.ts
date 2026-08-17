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
    // Cap at 2000 as a safety limit against an unbounded query, not as a
    // silent page size — 665 companies already exceeded the previous
    // hardcoded 500 and were invisible in the unfiltered list. Callers that
    // need true pagination should use limit/offset; the total count is
    // always returned so the frontend can tell it's not seeing everything.
    const limit = Math.min(Number(req.query.limit) || 2000, 2000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
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
    const countResult = await pool.query(`select count(*) from companies ${where}`, params);
    const orderBy = req.query.sort === "recent"
      ? `(select max(m.meeting_date) from meeting_notes m where m.company_id = companies.id) desc nulls last, name asc`
      : `meeting_count desc, name asc`;
    const result = await pool.query(
      `select id, name, category, name_variants, meeting_count, created_at,
         (select max(m.meeting_date) from meeting_notes m where m.company_id = companies.id) as last_meeting_date
       from companies ${where}
       order by ${orderBy}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ companies: result.rows, total: Number(countResult.rows[0].count) });
  })
);

const COMPANY_CATEGORIES = ["新規開拓", "既存代理店（店舗）", "既存代理店（マンション）", "直接販売"];

api.post(
  "/companies",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, category } = req.body ?? {};
    if (!name || !name.trim()) return res.status(400).json({ error: "会社名は必須です" });
    if (category && !COMPANY_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `categoryは次のいずれかにしてください: ${COMPANY_CATEGORIES.join(", ")}` });
    }

    const existing = await pool.query("select id, name, category from companies where lower(name) = lower($1)", [name.trim()]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: "同じ名前の取引先が既に登録されています", existing_company: existing.rows[0] });
    }

    const result = await pool.query(
      `insert into companies (name, category, meeting_count) values ($1, coalesce($2, '新規開拓'), 0) returning *`,
      [name.trim(), category || null]
    );
    res.json({ company: result.rows[0] });
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
    const proposals = await pool.query(
      "select * from proposals where company_id = $1 order by created_at desc",
      [req.params.id]
    );
    res.json({ company: company.rows[0], meetings: meetings.rows, actions: actions.rows, deals: deals.rows, contacts: contacts.rows, proposals: proposals.rows });
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

api.get(
  "/meeting-summaries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = req.query.status === "approved" ? "approved" : "draft";
    const result = await pool.query(
      `select s.*, m.company_id, c.name as company_name
       from meeting_summaries s
       join meeting_notes m on m.id = s.meeting_note_id
       join companies c on c.id = m.company_id
       where s.status = $1
       order by s.created_at desc`,
      [status]
    );
    res.json({ summaries: result.rows });
  })
);

// 保留中の下書きを再度開くための単票取得。次アクション候補はまだ next_actions に永続化されていないため
// （永続化は承認時のみ）、原文からルールベース抽出を再実行して候補を作り直す。
api.get(
  "/meeting-summaries/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const summary = await pool.query("select * from meeting_summaries where id = $1", [req.params.id]);
    if (!summary.rows[0]) return res.status(404).json({ error: "下書きが見つかりません" });
    const note = await pool.query("select * from meeting_notes where id = $1", [summary.rows[0].meeting_note_id]);
    const company = await pool.query("select id, name, category from companies where id = $1", [note.rows[0]?.company_id]);
    const extracted = extractFromText(note.rows[0]?.content ?? note.rows[0]?.raw_text ?? "");
    res.json({ summary: summary.rows[0], meeting_note: note.rows[0], company: company.rows[0] ?? null, suggested_actions: extracted.actions });
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
// トランザクション化・冪等化: 二重送信されても next_actions が重複作成されたり
// meeting_count が二重加算されたりしないよう、承認済みの場合は既存の結果をそのまま返す。
api.post(
  "/meeting-summaries/:id/approve",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { summary, decisions, issue, budget, decision_maker, timeline, actions } = req.body ?? {};
    const user = (req as unknown as { user: SessionUser }).user;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const summaryRow = await client.query("select * from meeting_summaries where id = $1 for update", [req.params.id]);
      if (!summaryRow.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "下書きが見つかりません" });
      }

      if (summaryRow.rows[0].status === "approved") {
        const existingActions = await client.query(
          "select * from next_actions where source_summary_id = $1 order by source_action_index",
          [req.params.id]
        );
        await client.query("ROLLBACK");
        return res.json({ summary: summaryRow.rows[0], actions: existingActions.rows, already_approved: true });
      }

      const note = await client.query("select company_id from meeting_notes where id = $1", [summaryRow.rows[0].meeting_note_id]);
      const companyId = note.rows[0]?.company_id;

      const updated = await client.query(
        `update meeting_summaries set
           summary = $1, decisions = $2, issue = $3, budget = $4, decision_maker = $5, timeline = $6,
           status = 'approved', edited = true, approved_at = now(), approved_by = $7
         where id = $8 and status = 'draft' returning *`,
        [summary, JSON.stringify(decisions ?? []), issue, budget, decision_maker, timeline, user?.id ?? null, req.params.id]
      );

      const createdActions = [];
      let index = 0;
      for (const a of actions ?? []) {
        if (a.description && (!a.priority || ACTION_PRIORITIES.includes(a.priority))) {
          const inserted = await client.query(
            `insert into next_actions (company_id, meeting_note_id, description, assignee, due_date, priority, source_summary_id, source_action_index)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             on conflict (source_summary_id, source_action_index) where source_summary_id is not null do nothing
             returning *`,
            [companyId, summaryRow.rows[0].meeting_note_id, a.description, a.assignee || null, a.due_date || null, a.priority || "中", req.params.id, index]
          );
          if (inserted.rows[0]) createdActions.push(inserted.rows[0]);
        }
        index += 1;
      }

      if (companyId) {
        await client.query("update companies set meeting_count = meeting_count + 1 where id = $1", [companyId]);
      }

      await client.query("COMMIT");
      res.json({ summary: updated.rows[0], actions: createdActions });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
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
    const { status, dismiss_reason, dismiss_snooze_until } = req.body ?? {};
    if (status && !ACTION_STATUSES.includes(status)) return res.status(400).json({ error: `statusは次のいずれかにしてください: ${ACTION_STATUSES.join(", ")}` });
    const user = (req as unknown as { user: SessionUser }).user;
    // dismissed_by is derived from the authenticated session, never trusted from the client,
    // and only set when this request is the one performing the dismissal.
    const isDismissing = status === "dismissed";
    const dismissedByName = isDismissing ? (user?.name ?? user?.email ?? null) : null;
    const dismissedByUserId = isDismissing ? (user?.id ?? null) : null;
    const result = await pool.query(
      `update next_actions set
         status = coalesce($1, status),
         dismiss_reason = coalesce($2, dismiss_reason),
         dismissed_by = coalesce($3, dismissed_by),
         dismissed_by_user_id = coalesce($4, dismissed_by_user_id),
         dismiss_snooze_until = coalesce($5, dismiss_snooze_until)
       where id = $6 returning *`,
      [status ?? null, dismiss_reason ?? null, dismissedByName, dismissedByUserId, dismiss_snooze_until ?? null, req.params.id]
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
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const inquiry = await client.query("select * from inbound_inquiries where id = $1 for update", [req.params.id]);
      if (!inquiry.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "問い合わせが見つかりません" });
      }
      if (inquiry.rows[0].status === "取引先化済み") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "すでに取引先化されています" });
      }

      let companyId = existing_company_id;
      if (!companyId) {
        const created = await client.query(
          `insert into companies (name, category, meeting_count) values ($1, '新規開拓', 0) returning id`,
          [inquiry.rows[0].company_name]
        );
        companyId = created.rows[0].id;
      }
      if (inquiry.rows[0].contact_name) {
        await client.query(`insert into contacts (company_id, name) values ($1, $2)`, [companyId, inquiry.rows[0].contact_name]);
      }
      // UI copy for this action reads "取引先と商談を作成" — create the initial deal here too.
      const deal = await client.query(
        `insert into deals (company_id, name, stage) values ($1, $2, '初回接触') returning *`,
        [companyId, `${inquiry.rows[0].company_name}・初回ヒアリング`]
      );
      const updated = await client.query(
        `update inbound_inquiries set status = '取引先化済み', converted_company_id = $1, converted_deal_id = $2 where id = $3 returning *`,
        [companyId, deal.rows[0].id, req.params.id]
      );

      await client.query("COMMIT");
      res.json({ inquiry: updated.rows[0], company_id: companyId, deal_id: deal.rows[0].id });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

const PROPOSAL_TYPES = ["提案書", "見積書", "契約書", "その他"];

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

api.post(
  "/companies/:id/proposals",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deal_id, type, title, url, version } = req.body ?? {};
    if (!title) return res.status(400).json({ error: "資料名は必須です" });
    if (!isHttpUrl(url)) return res.status(400).json({ error: "有効なURL（http/https）を入力してください" });
    if (type && !PROPOSAL_TYPES.includes(type)) return res.status(400).json({ error: `typeは次のいずれかにしてください: ${PROPOSAL_TYPES.join(", ")}` });
    const user = (req as unknown as { user: SessionUser }).user;
    const result = await pool.query(
      `insert into proposals (company_id, deal_id, type, title, url, version, created_by)
       values ($1, $2, coalesce($3, '提案書'), $4, $5, coalesce($6, 1), $7) returning *`,
      [req.params.id, deal_id || null, type || null, title, url, version || null, user?.name ?? user?.email ?? null]
    );
    res.json({ proposal: result.rows[0] });
  })
);

api.delete(
  "/proposals/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await pool.query("delete from proposals where id = $1", [req.params.id]);
    res.json({ ok: true });
  })
);

api.get(
  "/knowledge-items",
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(title ilike $${params.length} or body ilike $${params.length})`);
    }
    if (tag) {
      params.push(tag);
      conditions.push(`$${params.length} = any(tags)`);
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const result = await pool.query(
      `select k.*, c.name as source_company_name
       from knowledge_items k
       left join companies c on c.id = k.source_company_id
       ${where}
       order by k.created_at desc`,
      params
    );
    res.json({ items: result.rows });
  })
);

api.post(
  "/knowledge-items",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { title, body, tags, source_company_id, source_meeting_note_id } = req.body ?? {};
    if (!title) return res.status(400).json({ error: "タイトルは必須です" });
    const user = (req as unknown as { user: SessionUser }).user;
    const result = await pool.query(
      `insert into knowledge_items (title, body, tags, source_company_id, source_meeting_note_id, created_by)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [title, body || null, Array.isArray(tags) ? tags : [], source_company_id || null, source_meeting_note_id || null, user?.name ?? user?.email ?? null]
    );
    res.json({ item: result.rows[0] });
  })
);

// 打ち合わせ準備ブリーフィング: 既存の議事録・商談・提案書・ナレッジから、その場で組み立てる（新規テーブルは持たない）
api.get(
  "/companies/:id/briefing",
  requireAuth,
  asyncHandler(async (req, res) => {
    const company = await pool.query("select * from companies where id = $1", [req.params.id]);
    if (!company.rows[0]) return res.status(404).json({ error: "取引先が見つかりません" });

    const recentSummaries = await pool.query(
      `select s.*, m.meeting_date
       from meeting_summaries s
       join meeting_notes m on m.id = s.meeting_note_id
       where m.company_id = $1 and s.status = 'approved'
       order by m.meeting_date desc nulls last, m.created_at desc
       limit 2`,
      [req.params.id]
    );
    const [latest, previous] = recentSummaries.rows;

    const changes: string[] = [];
    if (latest && previous) {
      const fields: { key: keyof typeof latest; label: string }[] = [
        { key: "issue", label: "課題" },
        { key: "budget", label: "予算" },
        { key: "decision_maker", label: "決裁" },
        { key: "timeline", label: "時期" },
      ];
      for (const f of fields) {
        if ((latest[f.key] ?? null) !== (previous[f.key] ?? null) && latest[f.key]) {
          changes.push(`${f.label}: ${previous[f.key] ?? "未確認"} → ${latest[f.key]}`);
        }
      }
    }

    const openActions = await pool.query(
      "select description from next_actions where company_id = $1 and status = 'open' order by due_date asc nulls last limit 5",
      [req.params.id]
    );
    const toConfirm = [
      ...(latest?.unresolved ? [latest.unresolved] : []),
      ...openActions.rows.map((r) => r.description),
    ];

    const openDeal = await pool.query(
      "select * from deals where company_id = $1 and status = '進行中' order by created_at desc limit 1",
      [req.params.id]
    );

    const meetingCount = await pool.query("select count(*) from meeting_notes where company_id = $1", [req.params.id]);
    const proposalCount = await pool.query("select count(*) from proposals where company_id = $1", [req.params.id]);
    const knowledge = await pool.query(
      `select * from knowledge_items where source_company_id = $1 or source_company_id is null order by created_at desc limit 3`,
      [req.params.id]
    );

    res.json({
      company: company.rows[0],
      deal: openDeal.rows[0] ?? null,
      latest_summary: latest ?? null,
      to_confirm: toConfirm,
      changes_since_last: changes,
      knowledge: knowledge.rows,
      reference_counts: {
        meetings: Number(meetingCount.rows[0].count),
        proposals: Number(proposalCount.rows[0].count),
        knowledge: knowledge.rows.length,
      },
    });
  })
);

// 同じ区分（既存代理店/新規開拓など）の過去の承認済み議事録から、課題・予算感・決裁者・時期の
// 頻出パターンを集計する。LLMは使わず、既存データの単純な頻度集計のみで組み立てる。
function topValues(rows: Record<string, unknown>[], key: string, limit = 3) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = typeof row[key] === "string" ? row[key].trim() : "";
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

api.get(
  "/companies/:id/similar-approach",
  requireAuth,
  asyncHandler(async (req, res) => {
    const company = await pool.query("select * from companies where id = $1", [req.params.id]);
    if (!company.rows[0]) return res.status(404).json({ error: "取引先が見つかりません" });
    const category = company.rows[0].category;

    const summaries = await pool.query(
      `select s.issue, s.budget, s.decision_maker, s.timeline
       from meeting_summaries s
       join meeting_notes m on m.id = s.meeting_note_id
       join companies c on c.id = m.company_id
       where c.category = $1 and c.id != $2 and s.status = 'approved'`,
      [category, req.params.id]
    );

    const dealOutcomes = await pool.query(
      `select d.stage, d.status, count(*)::int as count
       from deals d join companies c on c.id = d.company_id
       where c.category = $1
       group by d.stage, d.status
       order by count desc`,
      [category]
    );

    // Below this, a "common" value is just 1-2 companies coincidentally sharing
    // a phrase — showing it as a trend would overstate what the data supports.
    const MIN_SAMPLE_SIZE = 3;
    const enoughData = summaries.rows.length >= MIN_SAMPLE_SIZE;

    res.json({
      category,
      sample_size: summaries.rows.length,
      min_sample_size: MIN_SAMPLE_SIZE,
      common_issues: enoughData ? topValues(summaries.rows, "issue") : [],
      common_budgets: enoughData ? topValues(summaries.rows, "budget") : [],
      common_decision_makers: enoughData ? topValues(summaries.rows, "decision_maker") : [],
      common_timelines: enoughData ? topValues(summaries.rows, "timeline") : [],
      deal_outcomes: dealOutcomes.rows,
    });
  })
);

api.get(
  "/reports/summary",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const dealsByStage = await pool.query(
      `select stage, count(*)::int as count, coalesce(sum(amount), 0) as amount_sum
       from deals where status = '進行中' group by stage`
    );
    const meetingsByMonth = await pool.query(
      `select to_char(coalesce(meeting_date, created_at), 'YYYY-MM') as month, count(*)::int as count
       from meeting_notes
       where coalesce(meeting_date, created_at) >= now() - interval '12 months'
       group by month order by month`
    );
    const companiesByCategory = await pool.query(
      `select category, count(*)::int as count from companies group by category order by count desc`
    );
    const inboundByStatus = await pool.query(
      `select status, count(*)::int as count from inbound_inquiries group by status`
    );
    const actionCounts = await pool.query(
      `select
         count(*) filter (where status = 'open')::int as open_count,
         count(*) filter (where status = 'open' and due_date < current_date)::int as overdue_count
       from next_actions`
    );

    res.json({
      deals_by_stage: dealsByStage.rows,
      meetings_by_month: meetingsByMonth.rows,
      companies_by_category: companiesByCategory.rows,
      inbound_by_status: inboundByStatus.rows,
      actions: actionCounts.rows[0],
    });
  })
);
