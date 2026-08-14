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
  // The login rate-limiter keys on req.ip. Behind a reverse proxy, Express
  // reports the proxy's own address for every client unless it's told to
  // trust X-Forwarded-For — but blindly trusting it here (with an unknown
  // number of hops) would let a client spoof that header to *evade* the rate
  // limit instead. Only enable this once the real deployment topology (hop
  // count to the trusted proxy) is known.
  if (process.env.TRUST_PROXY_HOPS) {
    app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
  }
  app.use(express.json());
  app.use(cookieParser());
  app.use(api);
  app.use(errorHandler);
  return app;
}
