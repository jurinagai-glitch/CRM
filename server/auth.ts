import "dotenv/config";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
const JWT_SECRET: string = process.env.JWT_SECRET;

const COOKIE_NAME = "relay_session";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; email: string; name: string | null; role: string };

export function signSession(user: SessionUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_MS,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "ログインが必要です" });
  try {
    const user = jwt.verify(token, JWT_SECRET) as unknown as SessionUser;
    (req as Request & { user?: SessionUser }).user = user;
    next();
  } catch {
    return res.status(401).json({ error: "セッションが無効です。再度ログインしてください" });
  }
}

export function getSessionUser(req: Request): SessionUser | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}
