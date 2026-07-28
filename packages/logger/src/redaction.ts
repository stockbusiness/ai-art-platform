/**
 * Field names that must never appear in plaintext in logs. Pino's `redact`
 * option uses fast-redact, which only supports fixed-depth path globs (no
 * recursive `**`), so we generate paths up to a fixed depth instead of
 * relying on arbitrary nesting.
 */
export const SENSITIVE_KEYS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "databaseUrl",
  "databaseDirectUrl",
  "DATABASE_URL",
  "DATABASE_DIRECT_URL",
  // PR-03A: the HMAC key used to hash IP/User-Agent/email before they
  // reach admin_sessions/admin_login_events (section 3.5 of the PR-03A
  // instructions) — never logged, even indirectly via a dumped env object.
  "authIpHashSecret",
  "AUTH_IP_HASH_SECRET",
] as const;

const MAX_DEPTH = 3;

function buildRedactPaths(keys: readonly string[]): string[] {
  const paths: string[] = [];
  for (const key of keys) {
    let path = key;
    paths.push(path);
    for (let depth = 1; depth < MAX_DEPTH; depth += 1) {
      path = `*.${path}`;
      paths.push(path);
    }
  }
  return paths;
}

export const REDACT_PATHS = buildRedactPaths(SENSITIVE_KEYS);

export const REDACT_CENSOR = "[REDACTED]";
