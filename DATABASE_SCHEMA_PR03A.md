# PR-03A データベーススキーマ (Database Schema)

## Prisma / PostgreSQL バージョン

- Prisma: `5.22.0`（PR-02と同一バージョンで固定）
- PostgreSQL: `16`

## Migration

| Migration名                                  | 内容                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `20260728070941_pr03a_admin_auth_foundation` | `admin_users`／`admin_sessions`／`admin_login_events`の新規作成（PR-02のMigrationは無編集） |

| `20260728090611_pr03a_review_fix_hardening` | 追加レビュー修正（P1-2〜P1-4）：CHECK制約1件、Hash形式CHECK制約7件、Index10件の追加。既存2件のMigrationは無編集 |

ファイル：
`prisma/migrations/20260728070941_pr03a_admin_auth_foundation/migration.sql`
`prisma/migrations/20260728090611_pr03a_review_fix_hardening/migration.sql`

## テーブル一覧

### `admin_users`

| カラム                | 型                        | 制約                                                                            |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `id`                  | `uuid`                    | PK                                                                              |
| `tenant_id`           | `uuid` nullable           | FK → `tenants.id`、`ON DELETE RESTRICT ON UPDATE RESTRICT`。SUPER_ADMINのみNULL |
| `email`               | `varchar(254)`            | 正規化済み（`lower(btrim(...))`）を保存                                         |
| `password_hash`       | `varchar(255)`            | Argon2id Hash文字列                                                             |
| `name`                | `varchar(120)`            | NOT NULL                                                                        |
| `role`                | `enum AdminRole`          | `SUPER_ADMIN` \| `TENANT_OWNER` \| `TENANT_ADMIN` \| `STAFF` \| `VIEWER`        |
| `status`              | `enum AdminStatus`        | `ACTIVE` \| `DISABLED`, default `ACTIVE`                                        |
| `failed_login_count`  | `integer`                 | default `0`、`>= 0`                                                             |
| `locked_until`        | `timestamptz(6)` nullable | Lockout解除時刻                                                                 |
| `last_login_at`       | `timestamptz(6)` nullable | 直近ログイン成功時刻                                                            |
| `password_changed_at` | `timestamptz(6)`          | default now                                                                     |
| `created_at`          | `timestamptz(6)`          | default now                                                                     |
| `updated_at`          | `timestamptz(6)`          | Prisma `@updatedAt`                                                             |

追加制約（Prismaのスキーマ言語では表現できず、Migration SQLへ直接記述）：

```sql
CREATE UNIQUE INDEX "admin_users_tenant_id_email_key"
  ON "admin_users"("tenant_id", "email") WHERE "tenant_id" IS NOT NULL;

CREATE UNIQUE INDEX "admin_users_email_super_admin_key"
  ON "admin_users"("email") WHERE "tenant_id" IS NULL;

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_tenant_check"
  CHECK (
    ("role" = 'SUPER_ADMIN' AND "tenant_id" IS NULL)
    OR ("role" <> 'SUPER_ADMIN' AND "tenant_id" IS NOT NULL)
  );

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_normalized_check"
  CHECK ("email" = lower(btrim("email")));

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_not_blank_check"
  CHECK (length(btrim("email")) > 0);

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_name_not_blank_check"
  CHECK (length(btrim("name")) > 0);

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_failed_login_count_check"
  CHECK ("failed_login_count" >= 0);
```

→ Tenant所属管理者は`(tenant_id, email)`単位で一意。SUPER_ADMINは
`email`単位でグローバルに一意。同一Emailを別Tenantで使う、または
Tenant管理者とSUPER_ADMINで共有することは許可される（`tenant_id`が
異なる／片方NULLのため部分Indexが競合しない）。

### `admin_sessions`

| カラム            | 型                        | 制約                                                           |
| ----------------- | ------------------------- | -------------------------------------------------------------- |
| `id`              | `uuid`                    | PK                                                             |
| `admin_user_id`   | `uuid`                    | FK → `admin_users.id`、`ON DELETE RESTRICT ON UPDATE RESTRICT` |
| `token_hash`      | `varchar(64)`             | UNIQUE。Session TokenのSHA-256 Hex digest（64文字）            |
| `csrf_token_hash` | `varchar(64)`             | CSRF TokenのSHA-256 Hex digest                                 |
| `expires_at`      | `timestamptz(6)`          | 発行時刻+`ADMIN_SESSION_TTL_SECONDS`（既定8時間）              |
| `last_seen_at`    | `timestamptz(6)`          | 最大5分に1回更新                                               |
| `revoked_at`      | `timestamptz(6)` nullable | Logout等でのRevoke時刻                                         |
| `revoke_reason`   | `varchar(50)` nullable    | 例：`USER_LOGOUT`                                              |
| `ip_hash`         | `varchar(64)` nullable    | HMAC-SHA256(`AUTH_IP_HASH_SECRET`, IP)                         |
| `user_agent_hash` | `varchar(64)` nullable    | HMAC-SHA256(`AUTH_IP_HASH_SECRET`, User-Agent)                 |
| `created_at`      | `timestamptz(6)`          | default now                                                    |
| `updated_at`      | `timestamptz(6)`          | `@updatedAt`                                                   |

`tenant_id`は保持しない — 認証後は`admin_users.tenant_id`から
Tenant Contextを取得する（section 4.3の設計方針通り）。

### `admin_login_events`

| カラム            | 型                                      | 制約                                                                         |
| ----------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| `id`              | `uuid`                                  | PK                                                                           |
| `admin_user_id`   | `uuid` nullable                         | FK → `admin_users.id`、`ON DELETE RESTRICT ON UPDATE RESTRICT`。未解決時NULL |
| `tenant_id`       | `uuid` nullable                         | FK → `tenants.id`、`ON DELETE RESTRICT ON UPDATE RESTRICT`。未解決時NULL     |
| `email_hash`      | `varchar(64)`                           | HMAC-SHA256(`AUTH_IP_HASH_SECRET`, 正規化済みEmail)                          |
| `success`         | `boolean`                               | NOT NULL                                                                     |
| `failure_reason`  | `enum AdminLoginFailureReason` nullable | 成功時NULL、失敗時必須                                                       |
| `ip_hash`         | `varchar(64)` nullable                  | HMAC-SHA256(`AUTH_IP_HASH_SECRET`, IP)                                       |
| `user_agent_hash` | `varchar(64)` nullable                  | HMAC-SHA256(`AUTH_IP_HASH_SECRET`, User-Agent)                               |
| `request_id`      | `varchar(100)`                          | NOT NULL（`randomUUID()`）                                                   |
| `created_at`      | `timestamptz(6)`                        | default now                                                                  |

Email／IP／User-Agentの平文はいずれのカラムにも保存されない（統合
テストで直接検証済み — `TEST_RESULTS_PR03A.md`参照）。

## 追加レビュー修正（`20260728090611_pr03a_review_fix_hardening`）

### CHECK制約

```sql
-- P1-2: 成功時はfailure_reasonなし、失敗時は必須
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_success_failure_reason_check"
  CHECK (
    (success = true AND failure_reason IS NULL)
    OR (success = false AND failure_reason IS NOT NULL)
  );

-- P1-4: *_hashカラムはSHA-256/HMAC-SHA256のHex digest（64文字小文字）固定形式。
-- NULL許容カラムはNULLまたはHex64のみ許可。
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_token_hash_format_check"
  CHECK (token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_csrf_token_hash_format_check"
  CHECK (csrf_token_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_ip_hash_format_check"
  CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_agent_hash_format_check"
  CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_email_hash_format_check"
  CHECK (email_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_ip_hash_format_check"
  CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE "admin_login_events" ADD CONSTRAINT "admin_login_events_user_agent_hash_format_check"
  CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$');
```

### Index（P1-3）

| テーブル             | Index                                                 | 用途                                  |
| -------------------- | ----------------------------------------------------- | ------------------------------------- |
| `admin_users`        | `tenant_id`, `status`, `locked_until`（各単独）       | Tenant別・状態別・Lockout判定の検索   |
| `admin_sessions`     | `admin_user_id`, `expires_at`, `revoked_at`（各単独） | FK結合・有効期限/失効判定             |
| `admin_login_events` | `created_at`                                          | 時系列監査クエリ                      |
| `admin_login_events` | `(admin_user_id, created_at)`                         | 管理者別履歴                          |
| `admin_login_events` | `(email_hash, created_at)`                            | Email別履歴                           |
| `admin_login_events` | `(ip_hash, success, created_at)`                      | IP単位Rate Limitのcountクエリ（P0-4） |

`EXPLAIN`（`enable_seqscan = off`でIndex利用可能性を強制確認）で
`admin_login_events_ip_hash_success_created_at_idx`が実際に選択可能で
あることを統合テストで確認済み（`TEST_RESULTS_PR03A.md`参照）。

## Enum

```text
AdminRole:
- SUPER_ADMIN
- TENANT_OWNER
- TENANT_ADMIN
- STAFF
- VIEWER

AdminStatus:
- ACTIVE
- DISABLED

AdminLoginFailureReason:
- INVALID_CREDENTIALS
- TENANT_UNAVAILABLE
- ACCOUNT_DISABLED
- ACCOUNT_LOCKED
- IP_RATE_LIMITED
```

`AdminLoginFailureReason`は外部レスポンスへそのまま返さない
（`packages/api-contracts`の`adminAuthErrorCodeSchema`は
`AUTHENTICATION_FAILED`/`TOO_MANY_ATTEMPTS`/`UNAUTHENTICATED`/
`FORBIDDEN`の4値のみを公開契約とする）。

## 命名規則

PR-02と同一：DB=`snake_case`、Prisma/TypeScript=`camelCase`
（`@map`/`@@map`）、Timestampはすべて`timestamptz`、主キー・外部キーは
すべてPostgreSQL `uuid`。

## ER概要（テキスト）

```text
tenants (PR-02)
  1 ── * admin_users        (tenant_id NULLABLE; SUPER_ADMINのみNULL)
  1 ── * admin_login_events (tenant_id NULLABLE)

admin_users
  1 ── * admin_sessions     (admin_user_id NOT NULL)
  1 ── * admin_login_events (admin_user_id NULLABLE — 未解決失敗も記録)
```

## 環境変数（PR-03A追加分）

| 変数                               | 用途                                                                       | 既定値                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `ADMIN_WEB_ORIGIN`                 | CORSの完全一致許可Origin                                                   | 必須（既定なし）                                            |
| `ADMIN_SESSION_TTL_SECONDS`        | Session/CSRF Cookieの有効期間                                              | `28800`（8時間）                                            |
| `ADMIN_LOGIN_WINDOW_SECONDS`       | IP単位Rate Limitの集計窓                                                   | `900`（15分）                                               |
| `ADMIN_LOGIN_ACCOUNT_MAX_FAILURES` | Account Lockoutの連続失敗閾値                                              | `5`                                                         |
| `ADMIN_LOGIN_IP_MAX_FAILURES`      | IP単位Rate Limitの失敗回数上限                                             | `20`                                                        |
| `ADMIN_LOCKOUT_SECONDS`            | Account Lockoutの継続時間                                                  | `900`（15分）                                               |
| `AUTH_IP_HASH_SECRET`              | Email/IP/User-AgentをHMAC-SHA256でHash化する際の鍵。16文字以上必須         | 必須（既定なし）                                            |
| `ADMIN_TRUST_PROXY_HOPS`           | Express `trust proxy`に渡す信頼するReverse Proxyのhop数（review-fix P0-5） | development/test：未設定（0扱い）。production：明示設定必須 |

`packages/config`の`apiEnvSchema`（Server-only Schema、apps/apiのみ）で
検証。

**訂正（review-fix時に判明した誤記）**：本書の旧版には
「`AUTH_IP_HASH_SECRET`は`packages/logger`の`SENSITIVE_KEYS`には未追加」
という記載があったが、これは誤り。実コードでは
`packages/logger/src/redaction.ts`の`SENSITIVE_KEYS`へ
`authIpHashSecret`/`AUTH_IP_HASH_SECRET`の両方が既に追加済みであり
（PR-03A初回実装時点から）、ログへ値が出力されるコードパスがあっても
redactionが機能する。
