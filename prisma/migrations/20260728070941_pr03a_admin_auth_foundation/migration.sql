-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'TENANT_OWNER', 'TENANT_ADMIN', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AdminLoginFailureReason" AS ENUM ('INVALID_CREDENTIALS', 'TENANT_UNAVAILABLE', 'ACCOUNT_DISABLED', 'ACCOUNT_LOCKED', 'IP_RATE_LIMITED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "AdminRole" NOT NULL,
    "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "csrf_token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" VARCHAR(50),
    "ip_hash" VARCHAR(64),
    "user_agent_hash" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_login_events" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID,
    "tenant_id" UUID,
    "email_hash" VARCHAR(64) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failure_reason" "AdminLoginFailureReason",
    "ip_hash" VARCHAR(64),
    "user_agent_hash" VARCHAR(64),
    "request_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_login_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- CreateIndex
-- Prisma cannot express a partial unique index in schema.prisma. Tenant-
-- scoped admins are unique per (tenant_id, email); SUPER_ADMIN rows
-- (tenant_id IS NULL) are unique per email globally — section 3.1 of the
-- PR-03A instructions. The same email may be reused across two different
-- Tenants, and a Tenant admin may share an email with a SUPER_ADMIN row
-- (login disambiguates by whether tenantKey is present).
CREATE UNIQUE INDEX "admin_users_tenant_id_email_key" ON "admin_users"("tenant_id", "email") WHERE "tenant_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_super_admin_key" ON "admin_users"("email") WHERE "tenant_id" IS NULL;

-- AddCheckConstraint
-- SUPER_ADMIN must be global (tenant_id NULL); every other role must
-- belong to exactly one Tenant. Enforced here, not just in
-- packages/domain/src/admin-auth/admin-user.ts's AdminUser.create(), so a
-- raw INSERT bypassing the Domain layer still cannot store an invalid
-- role/tenant_id combination.
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_tenant_check"
  CHECK (
    ("role" = 'SUPER_ADMIN' AND "tenant_id" IS NULL)
    OR ("role" <> 'SUPER_ADMIN' AND "tenant_id" IS NOT NULL)
  );

-- AddCheckConstraint
-- Mirrors packages/domain's AdminEmail.create() normalization (trim +
-- lowercase) at the database level.
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_normalized_check"
  CHECK ("email" = lower(btrim("email")));

-- AddCheckConstraint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_not_blank_check"
  CHECK (length(btrim("email")) > 0);

-- AddCheckConstraint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_name_not_blank_check"
  CHECK (length(btrim("name")) > 0);

-- AddCheckConstraint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_failed_login_count_check"
  CHECK ("failed_login_count" >= 0);
