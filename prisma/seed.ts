import { createPrismaClient } from "@ai-art-platform/database";

/**
 * PR-02 seed: the single "default" Tenant every local/CI environment needs
 * to exercise the Public Tenant Resolve endpoint. Idempotent (upsert on the
 * unique tenantKey), never creates an Admin User, LINE config, or Secret —
 * see section 10 of the PR-02 instructions.
 */
async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    await prisma.tenant.upsert({
      where: { tenantKey: "default" },
      update: {
        name: "AIアート教室",
        timezone: "Asia/Tokyo",
        defaultLocale: "ja-JP",
      },
      create: {
        tenantKey: "default",
        name: "AIアート教室",
        status: "ACTIVE",
        timezone: "Asia/Tokyo",
        defaultLocale: "ja-JP",
      },
    });
    // eslint-disable-next-line no-console
    console.log('Seed complete: tenant "default" is up to date.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
