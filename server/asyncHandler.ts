import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not forward rejected promises from async handlers to the
 * error middleware — an unhandled rejection there crashes the whole process.
 * Wrap every async route with this so a bad request/DB error becomes a JSON
 * 500 response instead of taking the server down for every user.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
