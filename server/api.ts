import bcrypt from "bcryptjs";
import { Router } from "express";
import { clearSessionCookie, getSessionUser, requireAuth, setSessionCookie, signSession } from "./auth";
import { pool } from "./db";

export const api = Router();

api.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "メールアドレスとパスワードを入力してください" });

  const result = await pool.query("select id, email, name, role, password_hash from app_users where email = $1", [email]);
  const row = result.rows[0];
  if (!row) return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });

  const user = { id: row.id, email: row.email, name: row.name, role: row.role };
  setSessionCookie(res, signSession(user));
  res.json({ user });
});

api.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

api.get("/auth/me", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "未ログインです" });
  res.json({ user });
});

api.get("/companies", requireAuth, async (req, res) => {
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
});

api.get("/companies/:id", requireAuth, async (req, res) => {
  const company = await pool.query("select * from companies where id = $1", [req.params.id]);
  if (!company.rows[0]) return res.status(404).json({ error: "取引先が見つかりません" });

  const meetings = await pool.query(
    "select * from meeting_notes where company_id = $1 order by meeting_date desc nulls last",
    [req.params.id]
  );
  res.json({ company: company.rows[0], meetings: meetings.rows });
});
