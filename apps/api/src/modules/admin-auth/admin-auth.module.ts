import {
  ADMIN_LOGIN_EVENT_REPOSITORY,
  ADMIN_SESSION_REPOSITORY,
  ADMIN_USER_REPOSITORY,
} from "@ai-art-platform/domain";
import { Module } from "@nestjs/common";

import { TenantModule } from "../tenant/tenant.module.js";

import { AuthenticateSessionUseCase } from "./application/authenticate-session.use-case.js";
import { GetCurrentAdminUseCase } from "./application/get-current-admin.use-case.js";
import { LoginAdminUseCase } from "./application/login-admin.use-case.js";
import { LogoutAdminUseCase } from "./application/logout-admin.use-case.js";
import { AUTH_CLOCK } from "./domain-services/auth-clock.port.js";
import { DB_TRANSACTION_PORT } from "./domain-services/db-transaction.port.js";
import { PASSWORD_HASHER } from "./domain-services/password-hasher.port.js";
import { SESSION_TOKEN_PORT } from "./domain-services/session-token.port.js";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password-hasher.js";
import { CryptoSessionTokenService } from "./infrastructure/crypto-session-token.service.js";
import { PrismaAdminLoginEventRepository } from "./infrastructure/prisma-admin-login-event.repository.js";
import { PrismaAdminSessionRepository } from "./infrastructure/prisma-admin-session.repository.js";
import { PrismaAdminUserRepository } from "./infrastructure/prisma-admin-user.repository.js";
import { PrismaDbTransactionService } from "./infrastructure/prisma-db-transaction.service.js";
import { SystemAuthClockService } from "./infrastructure/system-auth-clock.service.js";
import { AdminAuthController } from "./presentation/admin-auth.controller.js";
import { AdminAuthGuard } from "./presentation/admin-auth.guard.js";
import { CsrfGuard } from "./presentation/csrf.guard.js";
import { PermissionGuard } from "./presentation/permission.guard.js";
import { AdminTenantGuard } from "./presentation/tenant.guard.js";

@Module({
  // TenantModule exports TENANT_REPOSITORY (see tenant.module.ts) — login
  // and session authentication both need it to resolve a Tenant-scoped
  // admin's Tenant Context.
  imports: [TenantModule],
  controllers: [AdminAuthController],
  providers: [
    { provide: ADMIN_USER_REPOSITORY, useClass: PrismaAdminUserRepository },
    { provide: ADMIN_SESSION_REPOSITORY, useClass: PrismaAdminSessionRepository },
    { provide: ADMIN_LOGIN_EVENT_REPOSITORY, useClass: PrismaAdminLoginEventRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: SESSION_TOKEN_PORT, useClass: CryptoSessionTokenService },
    { provide: AUTH_CLOCK, useClass: SystemAuthClockService },
    { provide: DB_TRANSACTION_PORT, useClass: PrismaDbTransactionService },
    LoginAdminUseCase,
    LogoutAdminUseCase,
    GetCurrentAdminUseCase,
    AuthenticateSessionUseCase,
    AdminAuthGuard,
    CsrfGuard,
    PermissionGuard,
    AdminTenantGuard,
  ],
  exports: [
    ADMIN_USER_REPOSITORY,
    ADMIN_SESSION_REPOSITORY,
    ADMIN_LOGIN_EVENT_REPOSITORY,
    PASSWORD_HASHER,
    SESSION_TOKEN_PORT,
    AUTH_CLOCK,
  ],
})
export class AdminAuthModule {}
