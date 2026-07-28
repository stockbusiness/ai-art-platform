import type { ApiEnv } from "@ai-art-platform/config";
import type { Response } from "express";

/** Section 3.4. */
export const SESSION_COOKIE_NAME = "ai_art_admin_session";
export const CSRF_COOKIE_NAME = "ai_art_admin_csrf";

export interface SessionCookieOptions {
  secure: boolean;
  maxAgeMs: number;
}

/** production ⇒ Secure=true; development/test ⇒ Secure may be false (section 3.4). */
export function sessionCookieOptionsFor(env: ApiEnv): SessionCookieOptions {
  return {
    secure: env.NODE_ENV === "production",
    maxAgeMs: env.ADMIN_SESSION_TTL_SECONDS * 1000,
  };
}

export function setSessionCookies(
  res: Response,
  sessionToken: string,
  csrfToken: string,
  options: SessionCookieOptions,
): void {
  res.cookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
    maxAge: options.maxAgeMs,
  });
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
    maxAge: options.maxAgeMs,
  });
}

export function clearSessionCookies(res: Response, options: SessionCookieOptions): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
  });
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
  });
}
