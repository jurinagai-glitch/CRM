import cookieParser from "cookie-parser";
import express from "express";
import { api } from "./api";

export function createApiApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(api);
  return app;
}
