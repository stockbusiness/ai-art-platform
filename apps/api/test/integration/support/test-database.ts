/**
 * Provisions an isolated Postgres for integration tests. Prefers
 * TEST_DATABASE_URL when CI (or a developer) supplies one — see section
 * 16.5 of the PR-02 instructions, which explicitly allows combining a
 * CI-provided database with Testcontainers as the default. Falls back to
 * starting a disposable Testcontainers Postgres otherwise, so
 * `pnpm test:integration` works with zero setup on a machine with Docker.
 */
export interface ProvisionedTestDatabase {
  databaseUrl: string;
  teardown: () => Promise<void>;
}

export async function provisionTestDatabase(): Promise<ProvisionedTestDatabase> {
  const existingUrl = process.env["TEST_DATABASE_URL"];
  if (existingUrl) {
    return { databaseUrl: existingUrl, teardown: async () => {} };
  }

  const { GenericContainer, Wait } = await import("testcontainers");
  const container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: "ai_art_platform_test",
      POSTGRES_USER: "aiart",
      POSTGRES_PASSWORD: "aiart_local",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();

  const databaseUrl = `postgresql://aiart:aiart_local@${container.getHost()}:${container.getMappedPort(5432)}/ai_art_platform_test?schema=public`;

  return {
    databaseUrl,
    teardown: async () => {
      await container.stop();
    },
  };
}
