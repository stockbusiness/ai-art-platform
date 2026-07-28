import { randomUUID } from "node:crypto";

import * as argon2 from "argon2";
import { createPrismaClient } from "@ai-art-platform/database";
import {
  AdminEmail,
  AdminName,
  AdminUser,
  validateAdminPassword,
  type AdminRole,
} from "@ai-art-platform/domain";

/**
 * PR-03A Bootstrap CLI (`pnpm admin:bootstrap`, section 11). Creates the
 * very first Admin so a fresh environment is never left with no way to
 * log in. Deliberately outside `prisma/seed.ts` — this is never run
 * automatically (no fixed Admin credentials belong in an idempotent seed
 * script that could run in CI/production).
 */

const ROLES: readonly AdminRole[] = [
  "SUPER_ADMIN",
  "TENANT_OWNER",
  "TENANT_ADMIN",
  "STAFF",
  "VIEWER",
];

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readRole(): AdminRole {
  const raw = readRequiredEnv("BOOTSTRAP_ADMIN_ROLE");
  if (!ROLES.includes(raw as AdminRole)) {
    throw new Error(`BOOTSTRAP_ADMIN_ROLE must be one of: ${ROLES.join(", ")} (got "${raw}")`);
  }
  return raw as AdminRole;
}

async function main(): Promise<void> {
  const role = readRole();
  const emailRaw = readRequiredEnv("BOOTSTRAP_ADMIN_EMAIL");
  const password = readRequiredEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const nameRaw = readRequiredEnv("BOOTSTRAP_ADMIN_NAME");
  const tenantKeyRaw = process.env["BOOTSTRAP_TENANT_KEY"];

  if (role === "SUPER_ADMIN" && tenantKeyRaw) {
    throw new Error("BOOTSTRAP_TENANT_KEY must not be set when BOOTSTRAP_ADMIN_ROLE=SUPER_ADMIN");
  }
  if (role !== "SUPER_ADMIN" && !tenantKeyRaw) {
    throw new Error(`BOOTSTRAP_TENANT_KEY is required when BOOTSTRAP_ADMIN_ROLE=${role}`);
  }

  const emailResult = AdminEmail.create(emailRaw);
  if (!emailResult.ok) {
    throw emailResult.error;
  }
  const email = emailResult.value;

  const nameResult = AdminName.create(nameRaw);
  if (!nameResult.ok) {
    throw nameResult.error;
  }
  const name = nameResult.value;

  const passwordResult = validateAdminPassword(password, email);
  if (!passwordResult.ok) {
    throw passwordResult.error;
  }

  const prisma = createPrismaClient();
  try {
    let tenantId: string | null = null;
    if (tenantKeyRaw) {
      const tenant = await prisma.tenant.findUnique({ where: { tenantKey: tenantKeyRaw } });
      if (!tenant) {
        throw new Error(`Tenant "${tenantKeyRaw}" was not found`);
      }
      if (tenant.status !== "ACTIVE") {
        throw new Error(`Tenant "${tenantKeyRaw}" is not ACTIVE`);
      }
      tenantId = tenant.id;
    }

    const existing =
      tenantId !== null
        ? await prisma.adminUser.findFirst({ where: { tenantId, email: email.toString() } })
        : await prisma.adminUser.findFirst({
            where: { tenantId: null, email: email.toString(), role: "SUPER_ADMIN" },
          });
    if (existing) {
      throw new Error(
        `An admin with email "${email.toString()}" already exists${
          tenantId ? ` for tenant "${tenantKeyRaw}"` : " as a SUPER_ADMIN"
        }`,
      );
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const now = new Date();
    const admin = AdminUser.create({
      id: randomUUID(),
      tenantId,
      email,
      passwordHash,
      name,
      role,
      now,
    });

    await prisma.adminUser.create({
      data: {
        id: admin.id,
        tenant: tenantId ? { connect: { id: tenantId } } : undefined,
        email: admin.email.toString(),
        passwordHash: admin.passwordHash,
        name: admin.name.toString(),
        role: admin.role,
        status: admin.status,
        failedLoginCount: admin.failedLoginCount,
        passwordChangedAt: now,
        updatedAt: admin.updatedAt,
      },
    });

    // Never print the password or its hash — only confirm success.
    // eslint-disable-next-line no-console
    console.log(
      `Bootstrap admin created: ${email.toString()} (${role}${tenantKeyRaw ? `, tenant "${tenantKeyRaw}"` : ""})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Admin bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
