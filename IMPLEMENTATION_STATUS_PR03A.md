# PR-03A 実装状況 (Implementation Status)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## ベースブランチ / 作業ブランチ

- Base: `main`（開始基準Commit `ff0578b1126a51ef688b227212bd1b7db526ae53` — PR-02マージ済み）
- Work: `feat/pr-03a-admin-auth-rbac`

## コミットSHA

| コミット       | 内容                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| `7c7e19b`      | PR-03A本体実装（Admin認証・DB保存型Session・CSRF・Lockout・RBAC・Bootstrap CLI・CI拡張） |
| （本コミット） | 提出物11文書の追加                                                                       |

## スコープ

`AI_ART_PLATFORM_PR03A_ADMIN_AUTH_RBAC_INSTRUCTIONS.md` に従い、PR-01/PR-02の
モノレポ・PostgreSQL/Prisma・Tenant基盤の上に、管理者向けの認証・Session・
RBAC基盤のみを実装した。一般User、LINE Identity、共通ID、代理店、教室、
予約、利用権、画像生成、決済、Wallet/Point、本番デプロイ・Migrationは
一切実装していない。管理画面の本格実装（Login画面、Dashboard等）も
PR-03B以降として今回実装していない。

## 実装内容サマリ

| 区分                        | 内容                                                                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration                   | `20260728070941_pr03a_admin_auth_foundation`（`admin_users`/`admin_sessions`/`admin_login_events`の新規追加。PR-02のMigrationは無編集）                                                                          |
| packages/domain/admin-auth  | `AdminUser`, `AdminSession`, `AdminEmail`, `AdminName`, `AdminRole`/`AdminStatus`, `PasswordPolicy`, `Permission`/`RolePermissionMap`, Repository port群。フレームワーク非依存                                   |
| packages/api-contracts      | `adminLoginRequestSchema`, `adminLoginResponseSchema`, `adminMeResponseSchema`, `adminSummarySchema`, `adminRoleSchema`, `adminAuthErrorCodeSchema`                                                              |
| packages/config             | `apiEnvSchema`へ`ADMIN_WEB_ORIGIN`/`ADMIN_SESSION_TTL_SECONDS`/`ADMIN_LOGIN_WINDOW_SECONDS`/`ADMIN_LOGIN_ACCOUNT_MAX_FAILURES`/`ADMIN_LOGIN_IP_MAX_FAILURES`/`ADMIN_LOCKOUT_SECONDS`/`AUTH_IP_HASH_SECRET`を追加 |
| apps/api/modules/admin-auth | Application 4 UseCase、Infrastructure（Argon2id Hasher、Opaque Session Token生成/Hash、3 Prisma Repository）、Presentation（Controller 3 Endpoint、4 Guard、2 Decorator）                                        |
| Bootstrap CLI               | `pnpm admin:bootstrap`（`prisma/admin-bootstrap.ts`）。最初のSUPER_ADMINまたはTenant管理者を安全に作成                                                                                                           |
| CI                          | Database jobへMigration再実行no-op確認、Bootstrap CLI実行（成功＋重複拒否）を追加。Quality/Database jobの構成自体は維持（3 job）                                                                                 |
| 設計文書                    | `docs/architecture/{ADMIN_AUTH_POLICY,RBAC_POLICY}.md`、`docs/security/SESSION_COOKIE_CSRF_POLICY.md`、`docs/development/ADMIN_BOOTSTRAP.md`                                                                     |

## 実行コマンドと結果

すべて本ブランチのコミット `7c7e19b`（本体実装）に対し、真のClean Clone
環境で検証済み（詳細は `TEST_RESULTS_PR03A.md`）。

```bash
corepack enable
pnpm install --frozen-lockfile   # 成功
pnpm db:generate                 # 成功
pnpm db:validate                 # 成功
pnpm format:check                # 成功
pnpm lint                        # 成功
pnpm typecheck                   # 成功
pnpm test                        # 成功（202テスト、42ファイル）
pnpm build                       # 成功（11/11 workspace）

# Databaseあり環境（空DBへPR-02→PR-03Aの順に適用）
pnpm db:migrate:deploy           # 成功（2 migration適用・2回目は no-op）
pnpm db:seed                     # 成功（冪等）
pnpm admin:bootstrap             # 成功（初回SUPER_ADMIN作成、2回目は重複拒否で失敗）
pnpm test:integration            # 成功（81テスト、6ファイル）
```

CI実行結果（Ubuntu Quality / Windows Quality / Database job）は
`TEST_RESULTS_PR03A.md` に記載。

## 未実施項目

- staging Supabaseへの接続・Migration適用（本書ではPR-03Aのスコープ外と
  明記されており未実施）
- `apps/admin-web`の実運用ログイン画面・保護されたShellの実装
  （PR-03B「Admin Web Login and Protected Shell」で実装予定）
- Password Reset／Password変更／Forgot Password／MFA／Admin
  Create・Update・Delete API／Session一覧／他Session強制Logout
  （section 7.4に明記の通り本PRでは未実装）
- 一般User認証、LINE Login、共通ID、代理店、予約、画像生成、決済等
  （PR-04以降のスコープ）
- Testcontainersのフルパス（Docker Hubからの`postgres:16-alpine`取得）の
  本セッション内実行確認。PR-02から継続する既知の制約（
  `OPEN_QUESTIONS_PR03A.md`参照）。CIの`database` jobはGitHub
  Actionsのpostgresサービスコンテナを使うため、Testcontainersに依存
  しない設計とした。

## 未確認事項

- 実際のGitHub Actions Windows runner上での本ラウンドの
  `db:generate`/`db:validate`/`test`/`build`実行（ローカルではLinux上で
  のみ確認。CI実行結果は`TEST_RESULTS_PR03A.md`参照）。
- staging Supabase固有の挙動（Pooler接続とDirect接続の切替、
  `AUTH_IP_HASH_SECRET`等の実運用シークレット管理）は未検証
  （PR-03Aのスコープ外）。
- Account LockoutのAPI統合テストでは「Lock解除後（15分経過後）に
  再度Loginできること」を実時間待機せずに検証できていない
  （ドメイン層のUnit Testでは`FixedAuthClock`によりLock解除条件自体は
  検証済み — `packages/domain/src/admin-auth/admin-user.test.ts`参照）。

## 発生した問題（と対応）

詳細は `IMPLEMENTATION_HISTORY_PR03A.md` を参照。主なもの：

1. 統合テストの`AppModule`起動が`ApiConfigModule`のファクトリ経由で
   `ADMIN_WEB_ORIGIN`/`AUTH_IP_HASH_SECRET`を必須化したため、
   `global-setup.ts`にこれらのテスト専用デフォルト値を追加する必要が
   あった。
2. `argon2`パッケージのpostinstallビルドスクリプトがpnpmのデフォルト
   セキュリティポリシーで無効化されるが、prebuildify済みバイナリを
   `node-gyp-build`が解決するため実害がないことを確認した。
3. PR-02で発見・修正済みの「統合テストファイル間のクリーンアップ順序
   によるFK違反」パターンが、新規`admin_users`/`admin_sessions`/
   `admin_login_events`テーブルの追加によって再発する構造だったため、
   既存の`tenant-repository.integration.spec.ts`／
   `public-tenant-api.integration.spec.ts`の`beforeEach`へ子テーブルの
   削除を先に追加して予防した。

## 次PRへの引継ぎ

- PR-03B（Admin Web Login and Protected Shell）着手前に、
  `OPEN_QUESTIONS_PR03A.md`の未決事項を確認すること。
- 本PRで公開したのは`POST /login`・`GET /me`・`POST /logout`の3
  Endpointのみ。Admin作成・編集APIは`admin:manage` Permissionまで
  定義済みだが未公開 — PR-03B以降で管理画面と合わせて設計すること。
- `AdminTenantGuard`（`apps/api/src/modules/admin-auth/presentation/
tenant.guard.ts`）は本PRでは実際のRouteに適用されていない
  （Tenant-scoped Resource Endpointが存在しないため）。次PR以降で
  Tenant-scoped Endpointを追加する際は、必ずこのGuardを経由し、
  Session由来の`tenantId`のみを信頼すること。

## ロールバック方法

`ROLLBACK_PROCEDURE_PR03A.md` を参照。
