import { randomUUID } from "node:crypto";

import type { TenantErrorCode, TenantPublicResponse } from "@ai-art-platform/api-contracts";
import {
  InvalidTenantKeyError,
  TenantNotFoundError,
  TenantSuspendedError,
} from "@ai-art-platform/domain";
import { Controller, Get, HttpException, Param, ServiceUnavailableException } from "@nestjs/common";

import { ResolvePublicTenantByKeyUseCase } from "../application/resolve-public-tenant-by-key.use-case.js";

import { toTenantPublicResponse } from "./tenant-public-response.mapper.js";

/**
 * Only Controller this module exposes publicly (section 13.1/13.4). It
 * never calls Prisma directly — everything goes through the UseCase.
 */
@Controller("api/v1/public/tenants")
export class PublicTenantController {
  constructor(private readonly resolvePublicTenant: ResolvePublicTenantByKeyUseCase) {}

  @Get(":tenantKey")
  async resolve(@Param("tenantKey") tenantKey: string): Promise<TenantPublicResponse> {
    try {
      const tenant = await this.resolvePublicTenant.execute(tenantKey);
      return toTenantPublicResponse(tenant);
    } catch (error: unknown) {
      throw mapTenantErrorToHttp(error);
    }
  }
}

function errorBody(
  code: TenantErrorCode,
  message: string,
): { error: { code: TenantErrorCode; message: string; requestId: string } } {
  return { error: { code, message, requestId: randomUUID() } };
}

export function mapTenantErrorToHttp(error: unknown): HttpException {
  if (error instanceof InvalidTenantKeyError) {
    return new HttpException(errorBody("VALIDATION_ERROR", error.message), 400);
  }
  if (error instanceof TenantNotFoundError) {
    return new HttpException(errorBody("TENANT_NOT_FOUND", "Tenant not found"), 404);
  }
  if (error instanceof TenantSuspendedError) {
    return new HttpException(errorBody("TENANT_SUSPENDED", "Tenant is suspended"), 403);
  }
  // Any other failure (DB unreachable, unexpected error) is reported as
  // 503 without leaking connection details, SQL, or a stack trace.
  return new ServiceUnavailableException(errorBody("DATABASE_UNAVAILABLE", "Database unavailable"));
}
