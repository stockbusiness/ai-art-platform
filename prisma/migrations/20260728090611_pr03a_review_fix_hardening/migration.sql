-- CreateIndex
CREATE INDEX "admin_login_events_created_at_idx" ON "admin_login_events"("created_at");

-- CreateIndex
CREATE INDEX "admin_login_events_admin_user_id_created_at_idx" ON "admin_login_events"("admin_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_login_events_email_hash_created_at_idx" ON "admin_login_events"("email_hash", "created_at");

-- CreateIndex
CREATE INDEX "admin_login_events_ip_hash_success_created_at_idx" ON "admin_login_events"("ip_hash", "success", "created_at");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_user_id_idx" ON "admin_sessions"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "admin_sessions_revoked_at_idx" ON "admin_sessions"("revoked_at");

-- CreateIndex
CREATE INDEX "admin_users_tenant_id_idx" ON "admin_users"("tenant_id");

-- CreateIndex
CREATE INDEX "admin_users_status_idx" ON "admin_users"("status");

-- CreateIndex
CREATE INDEX "admin_users_locked_until_idx" ON "admin_users"("locked_until");

-- review-fix P1-2: mirrors the Domain layer's invariant that a failed
-- login event always carries its reason and a successful one never does
-- — a raw INSERT bypassing the Domain layer still cannot violate it.
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_success_failure_reason_check" CHECK (
  (success = true AND failure_reason IS NULL)
  OR
  (success = false AND failure_reason IS NOT NULL)
);

-- review-fix P1-4: every *_hash column is a fixed-format digest (SHA-256
-- hex or HMAC-SHA256 hex, both 64 lowercase hex characters) — this CHECK
-- rejects anything else (a plaintext value, a differently-shaped hash) at
-- the DB layer, independent of the Domain/Application layers' own
-- discipline. Nullable columns allow NULL or a valid hex64 value.
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_token_hash_format_check" CHECK (token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_csrf_token_hash_format_check" CHECK (csrf_token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_ip_hash_format_check" CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_agent_hash_format_check" CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_email_hash_format_check" CHECK (email_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_ip_hash_format_check" CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_user_agent_hash_format_check" CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$');
