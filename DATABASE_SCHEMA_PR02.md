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

| カラム           | 型                  | 制約                                                        |
| ---------------- | ------------------- | ----------------------------------------------------------- |
| `id`             | `uuid`              | PK, `default gen_random_uuid()` 相当（Prisma `uuid()`）     |
| `tenant_key`     | `varchar(50)`       | UNIQUE、作成後不変（アプリ層で保証）、CHECK制約あり（下記） |
| `name`           | `varchar(120)`      | NOT NULL、CHECK制約あり（下記）                             |
| `status`         | `enum TenantStatus` | `ACTIVE` \| `SUSPENDED`, default `ACTIVE`                   |
| `timezone`       | `varchar(64)`       | default `Asia/Tokyo`                                        |
| `default_locale` | `varchar(16)`       | default `ja-JP`                                             |
| `created_at`     | `timestamptz(6)`    | default now                                                 |
| `updated_at`     | `timestamptz(6)`    | Prisma `@updatedAt`                                         |

追加制約（Prismaのスキーマ言語では表現できず、Migration SQLへ直接記述。
`packages/domain/src/tenant/tenant-key.ts`の`TenantKey.create()`および
`tenant.ts`の`assertValidTenantName()`が実装するDomain層の検証を、
Domain層をバイパスするRaw SQL経由の書き込みに対してもDB自体が拒否できる
ようミラーしたもの）：

```sql
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_tenant_key_format_check"
  CHECK ("tenant_key" ~ '^[a-z0-9]([a-z0-9-]{1,48})[a-z0-9]$');

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_name_not_blank_check"
  CHECK (length(btrim("name")) > 0);
```

→ `tenant_key`：3〜50文字、小文字英数字とハイフンのみ、先頭・末尾は
ハイフン不可（上限50文字は列型`VARCHAR(50)`と合わせて二重に強制）。
→ `name`：空文字・空白のみの文字列を拒否（上限120文字は列型
`VARCHAR(120)`で強制、CHECK制約側は下限のみ担当）。

### `tenant_domains`

| カラム       | 型               | 制約                                                       |
| ------------ | ---------------- | ---------------------------------------------------------- |
| `id`         | `uuid`           | PK                                                         |
| `tenant_id`  | `uuid`           | FK → `tenants.id`、`ON DELETE RESTRICT ON UPDATE RESTRICT` |
| `host`       | `varchar(255)`   | UNIQUE、CHECK制約あり（下記）                              |
| `is_primary` | `boolean`        | default `false`                                            |
| `created_at` | `timestamptz(6)` | default now                                                |
| `updated_at` | `timestamptz(6)` | `@updatedAt`                                               |

追加制約（Prismaのスキーマ言語では表現できず、Migration SQLへ直接記述）：

```sql
CREATE UNIQUE INDEX "tenant_domains_tenant_id_primary_key"
  ON "tenant_domains"("tenant_id") WHERE "is_primary" = true;

ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_host_format_check"
  CHECK ("host" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$');
```

→ 1 Tenantにつき`is_primary = true`の行は最大1件のみ許可。
→ `host`：スキーム（`://`）・パス（`/`）・ポート（`:port`）・大文字・
空文字を含まない、小文字の複数ラベルホスト名のみ許可。
`packages/domain/src/tenant/tenant-domain-host.ts`の`TenantDomainHost`
Value Objectが実装する正規化・検証（小文字化、大文字小文字を同一視した
UNIQUE）を、Domain層をバイパスするRaw SQL経由の書き込みに対しても
DB自体が拒否できるようミラーしたもの。UNIQUE制約は小文字化済みの値に
対して機能するため、`Example.com`と`EXAMPLE.COM`は`TenantDomainHost`が
両方とも`example.com`へ正規化した上でDBへ渡すことで重複として検出される
（Domain層をバイパスした場合、DBの`UNIQUE`制約自体は大文字小文字を
区別する点に注意——一意性の大文字小文字非依存はDomain層の正規化に
依存する。CHECK制約は大文字を拒否することで、正規化されていない値が
そもそもDBへ到達すること自体を防いでいる）。

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
