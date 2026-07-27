# PR-02 実装状況 (Implementation Status)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 対象PR

PR #2 `PR-02 Database and Tenant Foundation`
https://github.com/stockbusiness/ai-art-platform/pull/2

## Base Branch / Work Branch

- Base: `main`（PR-01マージコミット `d249280cc45aa8466018180e9a28cded79542191`）
- Work: `feat/pr-02-database-tenant-foundation`

## コミットSHA

| コミット       | 内容                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| `eef7ed7`      | PR-02本体実装（Prisma/DB基盤、Tenant Domain、Public Tenant Resolve等）                    |
| `4a39ef2`      | CI修正（Quality jobのDATABASE_URL不足、turbo strict env modeによるTEST_DATABASE_URL欠落） |
| （本コミット） | 提出物7文書の追加                                                                         |

## スコープ

`AI_ART_PLATFORM_PR02_DATABASE_TENANT_INSTRUCTIONS.md` に従い、PR-01の
pnpm/Turborepo基盤の上にDatabase／Tenant基盤のみを実装した。管理者認証、
User、LINE、共通ID、代理店、予約、画像生成、決済等は一切実装していない。

## 実装内容サマリ

| 区分                   | 内容                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL Hosting     | ローカル：Docker Compose（`postgres:16-alpine`、`compose.yaml`）                                                                                                  |
| Prisma                 | `prisma/schema.prisma`（`prisma@5.22.0` / `@prisma/client@5.22.0`）                                                                                               |
| packages/database      | Prisma Client生成・共有のみ。業務ロジック・Controller・Domain参照なし                                                                                             |
| Migration              | `20260727101006_pr02_tenant_foundation`（Tenant／TenantDomain／TenantSettingの3テーブル。Primary Domain一意制約はRaw SQLで追加）                                  |
| Seed                   | `default` Tenantを冪等にUpsert                                                                                                                                    |
| packages/domain/tenant | `Tenant`, `TenantKey`, `TenantStatus`, Domain Error群, `TenantRepository` port。フレームワーク非依存（`domain-purity.test.ts`で構造的に検証）                     |
| packages/api-contracts | `TenantKeySchema`, `TenantPublicResponseSchema`, `TenantStatusSchema`, `TenantErrorCodeSchema`                                                                    |
| apps/api               | `DatabaseModule`（PrismaService）, `HealthModule`（`/health`,`/ready`）, `TenantModule`（4 UseCase + `PrismaTenantRepository` + 公開APIは1件のみ）                |
| 公開API                | `GET /api/v1/public/tenants/:tenantKey` のみ。管理APIは未公開（PR-03のAdmin認証待ち）                                                                             |
| packages/config        | `apiEnvSchema`（`DATABASE_URL`/`DATABASE_DIRECT_URL`必須化）、`loadDotEnv`                                                                                        |
| packages/logger        | `databaseUrl`/`databaseDirectUrl`/`DATABASE_URL`/`DATABASE_DIRECT_URL`をredaction対象に追加                                                                       |
| CI                     | Quality job（Ubuntu/Windows）に`db:generate`/`db:validate`追加。新規`database` job（Ubuntu）でmigrate deploy→seed→integration test                                |
| 設計文書               | `docs/architecture/{ID_POLICY,TENANT_POLICY,DATABASE_BOUNDARIES}.md`、`docs/database/{ER_DIAGRAM_PR02,MIGRATION_POLICY}.md`、`docs/development/LOCAL_DATABASE.md` |

## 実行コマンドと結果

すべて本ブランチのコミット `4a39ef2c68e6d1aea7a379565b34e6a779b2ead6` に対し、
真のClean Clone環境で検証済み（詳細は `TEST_RESULTS_PR02.md`）。

```bash
corepack enable
pnpm install --frozen-lockfile   # 成功
pnpm db:generate                 # 成功
pnpm db:validate                 # 成功（DATABASE_URL等はQuality jobではダミー値）
pnpm format:check                # 成功
pnpm lint                        # 成功
pnpm typecheck                   # 成功
pnpm test                        # 成功（71テスト、25ファイル）
pnpm build                       # 成功（11/11 workspace）
pnpm clean && pnpm build         # 成功

# Databaseあり環境
pnpm db:migrate:deploy           # 成功（空DBへ適用・2回目は no-op）
pnpm db:seed                     # 成功（冪等）
pnpm test:integration            # 成功（16テスト、3ファイル）
```

CI実行結果（Ubuntu Quality / Windows Quality / Database job）は
`TEST_RESULTS_PR02.md` に記載（本コミット時点でCI完了を確認済み）。

## 未実施項目

- staging Supabaseへの接続・Migration適用（本書ではPR-02のスコープ外と明記されており未実施）
- 実LINE Channelとの接続
- Testcontainersのフルパス（Docker Hubからの`postgres:16-alpine`取得）の
  本セッション内実行確認。ネットワークポリシーによりこのセッションの
  サンドボックスからのDocker Hub pullがブロックされていたため、
  `TEST_DATABASE_URL`環境変数を用いた代替パス（同じテストコード、
  実際のPostgreSQL 16に対して検証）で全16件の統合テストを検証した。
  Testcontainersパス自体はコード上は実装済みだが、このセッションでは
  実行確認できていない（`OPEN_QUESTIONS_PR02.md`参照）。CI（`database`
  job）はGitHub Actionsのpostgresサービスコンテナを使うため、
  Testcontainersにも依存しない設計とした。
- Admin Userテーブル・認証・RBAC・User・LINE・予約・決済等（PR-03以降）

## 未確認事項

- 実際のGitHub Actions Windows runner上での`db:generate`/`db:validate`
  実行（ローカルではLinux上でのみ確認。クロスプラットフォームな
  `prisma`/`docker compose` CLIのみを使用しているため高い信頼性の
  代理指標があるが、完全な代替ではない）。
- staging Supabase固有の挙動（Pooler接続とDirect接続の切替等）は
  未検証（PR-02のスコープ外）。

## 発生した問題（と対応）

詳細は `IMPLEMENTATION_HISTORY_PR02.md` を参照。主なもの：

1. `prisma validate`/`generate`が`DATABASE_URL`/`DATABASE_DIRECT_URL`の
   存在を要求する（接続はしないが未設定だとエラー）ため、DBを持たない
   Quality CI jobでダミー値の設定が必要だった。
2. Turborepo 2.xの既定strict env modeにより、`turbo run`経由のタスクへ
   `TEST_DATABASE_URL`が渡らず、統合テストが意図せずTestcontainers
   パスへフォールバックしていた。`turbo.json`のtaskに`env`を明示して解消。
3. Prisma生成物（`packages/database/generated/`）がPrettier/ESLintの
   対象に含まれ、大量のエラー・非常に遅いフォーマット処理が発生した。
   `.prettierignore`/`eslint.config.js`へ除外設定を追加して解消。
4. NestJSのDI（`@nestjs/testing`経由のフルアプリ起動）がVitestの既定
   esbuildトランスフォームで正しく動作しない（`emitDecoratorMetadata`
   非対応）ことが統合テストで判明。`unplugin-swc`を統合テスト用vitest
   設定にのみ導入して解消（`OPEN_QUESTIONS_PR01.md` 8番で予告されていた
   リスクが実際に顕在化した形）。
5. Prismaが生成する一意制約違反エラー（P2002）の`meta.target`が、
   Raw SQLで追加した部分一意インデックス（Primary Domain制約）に対しては
   カラム名（`tenant_id`）のみを返すことが判明し、当初の判定ロジックの
   誤りを修正した。

## 次PRへの引継ぎ

- PR-03（Admin User、認証、RBAC等）着手前に、`OPEN_QUESTIONS_PR02.md`の
  未決事項を確認すること。
- `CreateTenantUseCase`/`UpdateTenantUseCase`は実装済みだがHTTP公開して
  いない。PR-03のAdmin認証・RBAC実装後、管理APIとして公開するかどうかを
  判断すること。
- Testcontainersパスの実行確認（Docker Hubアクセスが可能な環境での
  `pnpm test:integration`実行）を、次回作業（人間の開発者環境、または
  ネットワーク制限のないセッション）で行うこと。

## ロールバック方法

`ROLLBACK_PROCEDURE_PR02.md` を参照。
