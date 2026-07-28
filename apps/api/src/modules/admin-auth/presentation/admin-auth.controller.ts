import {
  adminLoginRequestSchema,
  type AdminLoginResponse,
  type AdminMeResponse,
} from "@ai-art-platform/api-contracts";
import type { ApiEnv } from "@ai-art-platform/config";
import { AdminAuthenticationFailedError } from "@ai-art-platform/domain";
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";

import { API_ENV } from "../../../infrastructure/config/api-config.module.js";
import { requestIdOf } from "../../../infrastructure/http/request-id.js";
import type { AuthenticatedAdminContext } from "../application/authenticated-admin-context.js";
import { GetCurrentAdminUseCase } from "../application/get-current-admin.use-case.js";
import { LoginAdminUseCase } from "../application/login-admin.use-case.js";
import { LogoutAdminUseCase } from "../application/logout-admin.use-case.js";

import { mapAdminAuthErrorToHttp } from "./admin-auth-error.mapper.js";
import { AdminAuthGuard } from "./admin-auth.guard.js";
import { CsrfGuard } from "./csrf.guard.js";
import { CurrentAdmin } from "./current-admin.decorator.js";
import { PermissionGuard } from "./permission.guard.js";
import { RequirePermissions } from "./permissions.decorator.js";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookies,
  sessionCookieOptionsFor,
  setSessionCookies,
} from "./session-cookies.js";

/**
 * `req.cookies` is typed as `any` by @types/cookie-parser — narrow it once
 * here instead of at every call site.
 */
function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * The only 3 admin-auth endpoints PR-03A implements (section 7). No
 * Controller method calls Prisma directly — everything goes through a
 * UseCase.
 */
@Controller("api/v1/admin/auth")
export class AdminAuthController {
  constructor(
    private readonly loginAdmin: LoginAdminUseCase,
    private readonly logoutAdmin: LogoutAdminUseCase,
    private readonly getCurrentAdmin: GetCurrentAdminUseCase,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminLoginResponse> {
    // A malformed body must be reported identically to a wrong password
    // (section 3.2/7.1: only 401/429 are documented failure shapes for
    // this endpoint — no separate 400).
    const parsed = adminLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw mapAdminAuthErrorToHttp(
        new AdminAuthenticationFailedError("Invalid request body"),
        requestIdOf(req),
      );
    }

    try {
      const result = await this.loginAdmin.execute({
        tenantKeyRaw: parsed.data.tenantKey ?? null,
        emailRaw: parsed.data.email,
        password: parsed.data.password,
        ip: clientIp(req),
        userAgent: userAgentOf(req),
        requestId: requestIdOf(req),
      });

      setSessionCookies(
        res,
        result.sessionToken,
        result.csrfToken,
        sessionCookieOptionsFor(this.env),
      );

      return {
        data: {
          admin: {
            id: result.admin.id,
            tenantId: result.admin.tenantId,
            tenantKey: result.tenantKey,
            email: result.admin.email.toString(),
            name: result.admin.name.toString(),
            role: result.admin.role,
          },
        },
      };
    } catch (error: unknown) {
      throw mapAdminAuthErrorToHttp(error, requestIdOf(req));
    }
  }

  @UseGuards(AdminAuthGuard, PermissionGuard)
  @RequirePermissions("admin:self:read")
  @Get("me")
  me(@CurrentAdmin() admin: AuthenticatedAdminContext): AdminMeResponse {
    return { data: { admin: this.getCurrentAdmin.execute(admin) } };
  }

  @UseGuards(AdminAuthGuard, CsrfGuard)
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawToken = stringField(
      (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE_NAME],
    );
    if (rawToken) {
      await this.logoutAdmin.execute(rawToken);
    }
    clearSessionCookies(res, sessionCookieOptionsFor(this.env));
  }
}

/**
 * Express's `req.ip` respects the `trust proxy` setting configured in
 * `configureApp()` from `ADMIN_TRUST_PROXY_HOPS` (review-fix P0-5) — with
 * it at 0 (the default), this is the raw socket address; with an explicit
 * hop count, it's the corresponding `X-Forwarded-For` entry.
 */
function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

/** `req.headers["user-agent"]` is `string | string[] | undefined` per Express's types. */
function userAgentOf(req: Request): string {
  const value = req.headers["user-agent"];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return "";
}
