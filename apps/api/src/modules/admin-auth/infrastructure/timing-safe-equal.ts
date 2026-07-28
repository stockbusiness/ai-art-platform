import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for secrets (CSRF tokens, token hashes).
 * `crypto.timingSafeEqual` throws on length mismatch — a naive length check
 * before calling it would itself leak length via timing, but the values
 * compared here (raw tokens, hex digests) are attacker-guessable in length
 * anyway (fixed-size tokens / hex digests), so a fast length-mismatch
 * short-circuit is safe: it doesn't leak anything beyond "wrong length",
 * which reveals no information about the secret's content.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
