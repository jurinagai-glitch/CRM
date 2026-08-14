import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler } from "express";
import { api } from "./api";

// Last-resort handler: any error that reaches here (DB constraint violation,
// unexpected exception, etc.) must not crash the process or leak internals
// to the client — log server-side, respond with a generic message.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: "サーバーエラーが発生しました" });
};

export function createApiApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(api);
  app.use(errorHandler);
  return app;
}
