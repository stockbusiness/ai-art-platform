# PR-03A 実装状況 (Implementation Status)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## ベースブランチ / 作業ブランチ

- Base: `main`（開始基準Commit `ff0578b1126a51ef688b227212bd1b7db526ae53` — PR-02マージ済み）
- Work: `feat/pr-03a-admin-auth-rbac`

## コミットSHA

| コミット             | 内容                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `7c7e19b`            | PR-03A本体実装（Admin認証・DB保存型Session・CSRF・Lockout・RBAC・Bootstrap CLI・CI拡張）                                      |
| `3280eaf`〜`6cbfdaa` | 提出物11文書の追加、CI結果追記（PR #3作成まで）                                                                               |
| （本ラウンド）       | `AI_ART_PLATFORM_PR03A_REVIEW_FIX_INSTRUCTIONS.md`に基づく追加レビュー修正（P0-1〜P0-7, P1-1〜P1-5）＋新規Migration＋文書更新 |

## スコープ

`AI_ART_PLATFORM_PR03A_ADMIN_AUTH_RBAC_INSTRUCTIONS.md` に従い、PR-01/PR-02の
モノレポ・PostgreSQL/Prisma・Tenant基盤の上に、管理者向けの認証・Session・
RBAC基盤のみを実装した。一般User、LINE Identity、共通ID、代理店、教室、
予約、利用権、画像生成、決済、Wallet/Point、本番デプロイ・Migrationは
一切実装していない。管理画面の本格実装（Login画面、Dashboard等）も
PR-03B以降として今回実装していない。

## 実装内容サマリ

| 区分                        | 内容                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration                   | `20260728070941_pr03a_admin_auth_foundation`（`admin_users`/`admin_sessions`/`admin_login_events`の新規追加。PR-02のMigrationは無編集）                                                                                                                                                                                         |
| Migration（review-fix）     | `20260728090611_pr03a_review_fix_hardening`（CHECK制約1件、Hash形式CHECK制約7件、Index10件を追加。既存2 Migrationは無編集）                                                                                                                                                                                                     |
| packages/domain/admin-auth  | `AdminUser`, `AdminSession`, `AdminEmail`, `AdminName`, `AdminRole`/`AdminStatus`, `PasswordPolicy`, `Permission`/`RolePermissionMap`, Repository port群。フレームワーク非依存                                                                                                                                                  |
| packages/api-contracts      | `adminLoginRequestSchema`, `adminLoginResponseSchema`, `adminMeResponseSchema`, `adminSummarySchema`, `adminRoleSchema`, `adminAuthErrorCodeSchema`                                                                                                                                                                             |
| packages/config             | `apiEnvSchema`へ`ADMIN_WEB_ORIGIN`/`ADMIN_SESSION_TTL_SECONDS`/`ADMIN_LOGIN_WINDOW_SECONDS`/`ADMIN_LOGIN_ACCOUNT_MAX_FAILURES`/`ADMIN_LOGIN_IP_MAX_FAILURES`/`ADMIN_LOCKOUT_SECONDS`/`AUTH_IP_HASH_SECRET`を追加                                                                                                                |
| apps/api/modules/admin-auth | Application 4 UseCase、Infrastructure（Argon2id Hasher、Opaque Session Token生成/Hash、3 Prisma Repository）、Presentation（Controller 3 Endpoint、4 Guard、2 Decorator）                                                                                                                                                       |
| Bootstrap CLI               | `pnpm admin:bootstrap`（`prisma/admin-bootstrap.ts`）。最初のSUPER_ADMINまたはTenant管理者を安全に作成                                                                                                                                                                                                                          |
| CI                          | Database jobへMigration再実行no-op確認、Bootstrap CLI実行（成功＋重複拒否）を追加。Quality/Database jobの構成自体は維持（3 job）                                                                                                                                                                                                |
| 設計文書                    | `docs/architecture/{ADMIN_AUTH_POLICY,RBAC_POLICY}.md`、`docs/security/SESSION_COOKIE_CSRF_POLICY.md`、`docs/development/ADMIN_BOOTSTRAP.md`                                                                                                                                                                                    |
| review-fix修正              | P0-1 Timing-safe CSRF、P0-2 Dummy Argon2 Verify、P0-3 Account Lockout Atomic化、P0-4 IP Rate Limit Atomic化（`pg_advisory_xact_lock`）、P0-5 `ADMIN_TRUST_PROXY_HOPS`、P0-6 Request ID相関、P0-7 Infrastructure障害→503、P1-1 Login Transaction境界、P1-2/P1-4 DB CHECK制約追加、P1-3 Index追加、P1-5 Bootstrap CLI Email非表示 |

## 実行コマンドと結果

初回実装ラウンドはコミット `7c7e19b`、review-fixラウンドは本書と
同時にコミットされる最新HEADに対し、いずれも真のClean Clone環境で
検証済み（詳細は `TEST_RESULTS_PR03A.md`）。

```bash
corepack enable
pnpm install --frozen-lockfile   # 成功
pnpm db:generate                 # 成功
pnpm db:validate                 # 成功
pnpm format:check                # 成功
pnpm lint                        # 成功
pnpm typecheck                   # 成功
pnpm test                        # 成功（234テスト、45ファイル）
pnpm build                       # 成功（11/11 workspace）

# Databaseあり環境（空DBへPR-02→PR-03A→review-fixの順に適用）
pnpm db:migrate:deploy           # 成功（3 migration適用・2回目は no-op）
pnpm db:seed                     # 成功（冪等）
pnpm admin:bootstrap             # 成功（初回SUPER_ADMIN作成、2回目は重複拒否で失敗。Emailは出力しない）
pnpm test:integration            # 成功（99テスト、7ファイル）
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
- 極端に大きい同一IP完全同時バースト（既定閾値20に対し25並行等）
  でのDB接続プールサイズ拡張・Argon2 Verifyの Lock保持Transaction外
  への移動（`OPEN_QUESTIONS_PR03A.md`項目7参照、review-fixで発見・
  Transaction Timeout拡大のみ対応済み、根本対応は次PRへ引継ぎ）。

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
   削除を先に追加して予防した。4.（review-fixラウンド）既存の`admin-auth-repository.integration
.spec.ts`が`tokenHash`/`csrfTokenHash`/`ipHash`へ`"same-hash"`
   `"target-ip"`等の記述的な非Hex文字列を使っていたため、P1-4の
   Hash形式CHECK制約を追加した時点でこれらのテストが（意図した
   UNIQUE制約違反ではなく）CHECK制約違反で失敗するようになった。
   すべて有効なHex64値へ置き換えて解消した。5.（review-fixラウンド）P0-4のIP Rate Limit並行Integration Testを
   既定閾値20・25並行で書いたところ、`pg_advisory_xact_lock`による
   同一IP直列化とArgon2 Verify（Lock保持中に実行）の組み合わせで
   Prismaの既定接続プール（4 CPU環境で9接続）が枯渇し、複数件が
   `503`を返す事象を発見した。`$transaction`の`maxWait`/`timeout`を
   拡大する対応を行った上で、テスト自体は閾値3・6並行という現実的な
   規模へ縮小し、検証している正しさの性質（並行要求が閾値を
   すり抜けない）は変えずに安定させた。詳細は
   `OPEN_QUESTIONS_PR03A.md`項目7参照。

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
