import { createHmac } from "node:crypto";

/**
 * HMAC-SHA256(AUTH_IP_HASH_SECRET, value), hex-encoded — used for
 * ip_hash/user_agent_hash/email_hash (sections 3.5/4.3/4.4). A keyed HMAC
 * (not a bare SHA-256) so the hashes cannot be reversed by an attacker who
 * only has the DB dump — they would also need `AUTH_IP_HASH_SECRET`.
 */
export function hashWithSecret(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}
