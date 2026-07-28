import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "X-Request-ID";

interface RequestWithRequestId extends Request {
  requestId?: string;
}

/**
 * Assigns exactly one request ID per request, at the very start of the
 * middleware chain — before any Guard, UseCase, or Controller runs — so
 * the same value can be threaded into `admin_login_events.request_id`
 * *and* the HTTP error response's `error.requestId`, letting an operator
 * correlate a client-visible failure with its server-side audit row
 * (review-fix P0-6). Always generated server-side; an incoming
 * `X-Request-ID` header is never trusted as the correlation ID, since a
 * client-supplied value could otherwise be used to try to correlate
 * requests across sessions or spoof a previous request's ID.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  (req as RequestWithRequestId).requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

/**
 * Reads the ID `requestIdMiddleware` attached to this request. The
 * fallback only fires if the middleware was somehow skipped (a
 * programmer error, since `configureApp()` always registers it) — it
 * exists so a missing ID degrades to a clearly-fake placeholder instead
 * of a runtime crash.
 */
export function requestIdOf(req: Request): string {
  return (req as RequestWithRequestId).requestId ?? "missing-request-id";
}
