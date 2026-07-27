# PR-02 データベーススキーマ (Database Schema)

## Prisma / PostgreSQL バージョン

- Prisma: `5.22.0`（CLI／`@prisma/client`とも同一バージョンで固定）
- PostgreSQL: `16`（`postgres:16-alpine`、`compose.yaml`／CI `database` job共通）

## Migration

| Migration名                             | 内容                                                     |
| --------------------------------------- | -------------------------------------------------------- |
| `20260727101006_pr02_tenant_foundation` | `tenants`／`tenant_domains`／`tenant_settings`の初回作成 |

ファイル：
`prisma/migrations/20260727101006_pr02_tenant_foundation/migration.sql`

## テーブル一覧

### `tenants`

| カラム           | 型                  | 制約                                                    |
| ---------------- | ------------------- | ------------------------------------------------------- |
| `id`             | `uuid`              | PK, `default gen_random_uuid()` 相当（Prisma `uuid()`） |
| `tenant_key`     | `varchar(50)`       | UNIQUE、作成後不変（アプリ層で保証）                    |
| `name`           | `varchar(120)`      | NOT NULL                                                |
| `status`         | `enum TenantStatus` | `ACTIVE` \| `SUSPENDED`, default `ACTIVE`               |
| `timezone`       | `varchar(64)`       | default `Asia/Tokyo`                                    |
| `default_locale` | `varchar(16)`       | default `ja-JP`                                         |
| `created_at`     | `timestamptz(6)`    | default now                                             |
| `updated_at`     | `timestamptz(6)`    | Prisma `@updatedAt`                                     |

### `tenant_domains`

| カラム       | 型               | 制約                                                       |
| ------------ | ---------------- | ---------------------------------------------------------- |
| `id`         | `uuid`           | PK                                                         |
| `tenant_id`  | `uuid`           | FK → `tenants.id`、`ON DELETE RESTRICT ON UPDATE RESTRICT` |
| `host`       | `varchar(255)`   | UNIQUE                                                     |
| `is_primary` | `boolean`        | default `false`                                            |
| `created_at` | `timestamptz(6)` | default now                                                |
| `updated_at` | `timestamptz(6)` | `@updatedAt`                                               |

追加制約（Prismaのスキーマ言語では表現できず、Migration SQLへ直接記述）：

```sql
CREATE UNIQUE INDEX "tenant_domains_tenant_id_primary_key"
  ON "tenant_domains"("tenant_id") WHERE "is_primary" = true;
```

→ 1 Tenantにつき`is_primary = true`の行は最大1件のみ許可。

### `tenant_settings`

| カラム       | 型               | 制約                                                           |
| ------------ | ---------------- | -------------------------------------------------------------- |
| `id`         | `uuid`           | PK                                                             |
| `tenant_id`  | `uuid`           | FK → `tenants.id`、`ON DELETE RESTRICT ON UPDATE RESTRICT`     |
| `key`        | `varchar(100)`   | -                                                              |
| `value_json` | `jsonb`          | -                                                              |
| `is_secret`  | `boolean`        | default `false`（PR-02では常にfalse。秘密情報保存APIは未実装） |
| `version`    | `integer`        | default `1`                                                    |
| `created_at` | `timestamptz(6)` | default now                                                    |
| `updated_at` | `timestamptz(6)` | `@updatedAt`                                                   |

制約：`UNIQUE (tenant_id, key)`

## Enum

```text
TenantStatus:
- ACTIVE
- SUSPENDED
```

## 命名規則

- DB: `snake_case`（例：`tenant_key`, `default_locale`）
- Prisma / TypeScript: `camelCase`（`@map`/`@@map`で対応）
- Timestamp: すべて `timestamptz`
- 主キー・外部キー: すべて PostgreSQL `uuid`

## ER図

Mermaid形式の詳細図は `docs/database/ER_DIAGRAM_PR02.md` を参照。

## 環境変数

| 変数                  | 用途                                                          |
| --------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`        | API実行時接続。SupabaseではPoolerを使用可能（本PRでは未接続） |
| `DATABASE_DIRECT_URL` | `prisma migrate`用のDirect接続                                |

ローカル開発・CIとも、両方の値は同一のPostgreSQL URLで運用している
（`compose.yaml`のcredentialsに準拠）。
