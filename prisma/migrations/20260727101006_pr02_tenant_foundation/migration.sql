-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "tenant_key" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Tokyo',
    "default_locale" VARCHAR(16) NOT NULL DEFAULT 'ja-JP',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_domains" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value_json" JSONB NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_tenant_key_key" ON "tenants"("tenant_key");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_domains_host_key" ON "tenant_domains"("host");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key_key" ON "tenant_settings"("tenant_id", "key");

-- AddForeignKey
ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- CreateIndex
-- Prisma cannot express a partial unique index in schema.prisma, so it is
-- added here explicitly: at most one Primary Domain per Tenant (section 8.4
-- of the PR-02 instructions). Non-primary domains are unaffected.
CREATE UNIQUE INDEX "tenant_domains_tenant_id_primary_key" ON "tenant_domains"("tenant_id") WHERE "is_primary" = true;
