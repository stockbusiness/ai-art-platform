import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import type { GeneratedToken, SessionTokenPort } from "../domain-services/session-token.port.js";

/** >= 32 bytes of cryptographic randomness, base64url-encoded (section 3.4). */
const TOKEN_BYTES = 32;

function generate(): GeneratedToken {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

@Injectable()
export class CryptoSessionTokenService implements SessionTokenPort {
  generateSessionToken(): GeneratedToken {
    return generate();
  }

  generateCsrfToken(): GeneratedToken {
    return generate();
  }

  hash(raw: string): string {
    return hashToken(raw);
  }
}
