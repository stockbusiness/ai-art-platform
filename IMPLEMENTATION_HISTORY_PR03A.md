# PR-03A 実装履歴 (Implementation History)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## Base Branch / Work Branch

- Base: `main`（開始基準Commit `ff0578b`、PR-02マージ済み）
- Work: `feat/pr-03a-admin-auth-rbac`

## 作業開始前確認の結果

1. リポジトリ：`stockbusiness/ai-art-platform`で正しかった。
2. `main`の最新コミットは`ff0578b1126a51ef688b227212bd1b7db526ae53`
   （`Merge pull request #2 from .../feat/pr-02-database-tenant-foundation`）
   で、指示書記載の開始基準Commitと一致することを確認した。
3. `feat/pr-03a-admin-auth-rbac`を`ff0578b`から新規作成した。
4. PR-02回帰確認：`pnpm test`/`pnpm typecheck`/`pnpm lint`を作業開始前
   に実行し、全ワークスペースが成功することを確認した（PR-02時点の
   91 unit test / 37 integration testが全件成功）。

## 実装順序（時系列、指示書に対応）

1. `main`最新化・作業ブランチ作成（上記）。
2. 既存コード調査：`packages/domain/src/tenant/*`、
   `apps/api/src/modules/tenant/*`、`packages/config/src/env.ts`、
   `.github/workflows/ci.yml`、統合テストの`global-setup.ts`／
   `create-test-app.ts`を読み、PR-02の設計パターン（Value Object +
   `Result`型、Repository port + DIトークン文字列、Prisma Row→Domain
   Mapper、Domain ErrorのHTTPマッピング）を踏襲する方針を確定した。
3. `argon2`/`helmet`/`cookie-parser`をnpmレジストリから解決可能なこと
   を確認し、`apps/api`（と、Bootstrap CLI用に`argon2`をルート）へ
   追加。ネイティブビルドスクリプトはpnpmのデフォルトポリシーで無効化
   されるが、prebuildify済みバイナリで動作することを確認した。
4. `prisma/schema.prisma`へ`AdminRole`/`AdminStatus`/
   `AdminLoginFailureReason` enumと`AdminUser`/`AdminSession`/
   `AdminLoginEvent`モデルを追加。
5. `prisma migrate dev --create-only`でベースMigration SQLを生成し、
   Prismaが表現できない部分UNIQUE Index 2件とCHECK制約5件を手動追記
   （section 4.2の仕様通り）。ローカルDBへ適用し`psql`の`\d`で構造を
   確認。
6. `packages/domain/src/admin-auth/`作成：`AdminEmail`/`AdminName`
   （正規化Value Object）、`AdminRole`/`AdminStatus`（固定リテラル
   Union）、`PasswordPolicy`（`validateAdminPassword`関数）、
   `Permission`/`RolePermissionMap`（固定Permission Matrix）、
   `AdminUser`/`AdminSession`（Entity、Lockout・Session有効性判定を
   保有）、Repository port 3種 + DIトークン、Domain Error 8種。
7. `packages/config/src/env.ts`の`apiEnvSchema`へPR-03A用7環境変数
   （`ADMIN_WEB_ORIGIN`他）を追加。
8. `apps/api/src/infrastructure/config/api-config.module.ts`（`API_ENV`
   トークンでNest DIへ検証済み`ApiEnv`を供給するGlobal Module）を新規
   作成。
9. `apps/api/src/modules/admin-auth/`作成：
   - `domain-services/`：`PasswordHasher`/`SessionTokenPort`/
     `AuthClock` port。
   - `infrastructure/`：`Argon2PasswordHasher`、
     `CryptoSessionTokenService`（Node `crypto`、SHA-256）、
     `SystemAuthClockService`、Prisma Repository 3種＋Mapper、
     `hashWithSecret`（HMAC-SHA256、IP/UA/Email用）。
   - `application/`：`LoginAdminUseCase`（IP Rate Limit→Email検証→
     Tenant解決→Admin検索→Disabled確認→Lockout確認→Password照合→
     Session発行、の順で処理し、失敗理由をすべて`admin_login_events`
     へ記録しつつ外部へは`AdminAuthenticationFailedError`/
     `AdminTooManyAttemptsError`の2種類のみ投げる）、
     `AuthenticateSessionUseCase`（Guard専用、Session→Admin→Tenant
     の順で検証しContextを構築）、`LogoutAdminUseCase`（冪等）、
     `GetCurrentAdminUseCase`（純粋なMapping）。
   - `presentation/`：`AdminAuthController`（3 Endpoint）、
     `AdminAuthGuard`/`CsrfGuard`/`PermissionGuard`/`AdminTenantGuard`、
     `CurrentAdmin`/`RequirePermissions`デコレータ、Cookie設定
     ヘルパー、Domain Error→HTTPマッパー。
10. `apps/api/src/bootstrap/configure-app.ts`（helmet／cookie-parser／
    CORS設定を`main.ts`と統合テストの`createTestApp()`で共有）を新規
    作成し、両方から呼び出すよう変更。
11. `packages/api-contracts/src/admin-auth/`作成：Login Request/
    Response、Me Response、AdminSummary、AdminRole、
    AdminAuthErrorCodeのZod Schema。
12. `prisma/admin-bootstrap.ts`（Bootstrap CLI）作成。root
    `package.json`へ`admin:bootstrap`スクリプトと
    `@ai-art-platform/domain`依存を追加。
13. Unit Test作成・実行：Domain 57件、apps/api 42件（Application
    UseCase・Infrastructure実装の両方）。
14. Integration Test作成・実行：`admin-auth-repository.integration.
spec.ts`（20件、DB CHECK制約・部分UNIQUE Index・Repository永続化・
    監査ログの非平文保存を検証）、`admin-auth-api.integration.spec.ts`
    （24件、Login成功/失敗全パターン・Lockout・IP Rate Limit・
    Session・CSRF・Tenant境界をHTTP経由で検証）。
15. 既存の`tenant-repository.integration.spec.ts`／
    `public-tenant-api.integration.spec.ts`の`beforeEach`へ、新規
    `admin_*`テーブルの削除をFK-safeな順序で追加（後述の問題1参照）。
16. Migration Test実行（空DB→PR-02→PR-03Aの順に適用→再実行(no-op)→
    seed→admin:bootstrap→integration test→DB破棄）。
17. CI拡張（`.github/workflows/ci.yml`のDatabase jobへMigration再実行
    ステップ・Bootstrap CLIステップ2つを追加、`ADMIN_WEB_ORIGIN`/
    `AUTH_IP_HASH_SECRET`を環境変数へ追加）。
18. Clean Clone検証（別ディレクトリへの実clone、詳細は
    `TEST_RESULTS_PR03A.md`）。
19. README・設計文書更新（`docs/architecture/{ADMIN_AUTH_POLICY,
RBAC_POLICY}.md`、`docs/security/SESSION_COOKIE_CSRF_POLICY.md`、
    `docs/development/ADMIN_BOOTSTRAP.md`）。
20. 提出物11文書作成（本書含む）。
21. 自己レビュー（Secret混入・PHP参照・PR-04以降機能混入チェック）。
22. Commit・Push（`7c7e19b`→本コミット）。
23. Draft PR作成。

## 発生した問題と解決方法

### 1. 既存統合テストの`beforeEach`クリーンアップ順序が新規`admin_*`テーブルとの間で再びFK違反を起こす構造だった

- PR-02の追加修正ラウンドで、`tenant_domains`/`tenant_settings`の
  `ON DELETE RESTRICT`外部キーにより`tenant-repository.integration.
spec.ts`と`public-tenant-api.integration.spec.ts`間でFK違反が
  発生した経緯があり、その時点で両ファイルとも「子テーブル→親テーブル」
  の順で削除する`beforeEach`へ修正済みだった。
- 今回`admin_users`/`admin_sessions`/`admin_login_events`が同じく
  `tenants`（および`admin_users`）へ`ON DELETE RESTRICT`で外部キーを
  張ったため、既存2ファイルの`beforeEach`をそのままにすると、
  Vitestの統合テスト設定（`fileParallelism: false`、全specファイルが
  同一DBを順次共有）の下で、`admin-auth-*.integration.spec.ts`が
  残した`admin_*`行によって同じ種類のFK違反が再発する構造だった。
- 対応：両ファイルの`beforeEach`へ`admin_login_events`→
  `admin_sessions`→`admin_users`の削除を、既存の`tenant_settings`→
  `tenant_domains`→`tenants`削除より前に追加した。新規作成した
  `admin-auth-repository.integration.spec.ts`／
  `admin-auth-api.integration.spec.ts`も同じ順序を最初から採用した。

### 2. 統合テストの`AppModule`起動が新規必須環境変数を要求するようになった

- `ApiConfigModule`のファクトリ（`apps/api/src/infrastructure/config/
api-config.module.ts`）が`apiEnvSchema`（`ADMIN_WEB_ORIGIN`/
  `AUTH_IP_HASH_SECRET`必須化を含む）を`process.env`から検証するため、
  `Test.createTestingModule({ imports: [AppModule] }).compile()`を
  呼ぶあらゆる統合テストが、これらの環境変数なしでは
  `EnvValidationError`で失敗するようになった。
- 対応：`apps/api/test/integration/global-setup.ts`へ、テスト専用の
  決定的なデフォルト値（`ADMIN_WEB_ORIGIN=http://localhost:5173`、
  `AUTH_IP_HASH_SECRET=integration-test-only-secret-not-for-real-use`）
  を`process.env[...] ??= ...`で追加した（既存の値を尊重しつつ、
  未設定時のみデフォルトを補う）。

### 3. `argon2`のpostinstallビルドスクリプトがpnpmのデフォルトポリシーで無効化される

- `pnpm add argon2`実行時、pnpmは信頼していないパッケージの
  ビルドスクリプト（postinstall等）をデフォルトで実行しない
  （`Ignored build scripts: argon2@0.45.1`という警告が出る）。
- 確認：`argon2`パッケージの`install`スクリプトは`node-gyp-build`を
  呼ぶだけであり、これは事前にビルド済みのバイナリ
  （`node_modules/argon2/prebuilds/linux-x64/argon2.glibc.node`等）を
  実行時に選択するだけの処理であることをパッケージのソースを確認して
  特定した。実際に`import("argon2")`→`argon2.hash()`を直接実行し、
  正常に`$argon2id$...`形式のHashが得られることを確認した。
- 対応：`pnpm approve-builds`は対話的プロンプトのためこのセッションの
  非対話シェルから実行できなかったが、実害がないことを確認済みのため
  未実施のままとした（CI環境・開発者環境でも同様にprebuildが機能する
  限り問題にならない）。Clean Clone検証でも同じ現象・同じ回避可能性を
  再確認した。

### 4. Raw SQLでの`admin_users`直接INSERTテストにおける`gen_random_uuid()`のUUID型キャスト

- PR-02の追加修正ラウンドで発見・修正した「Raw SQL挿入時の`tenant_id`
  UUID型キャスト漏れ」パターンを踏まえ、`admin-auth-repository.
integration.spec.ts`のRaw SQLヘルパー（`rawInsertAdminUser`）では
  最初から`$1::uuid`の明示キャストを付けて実装し、同じ不具合の再発を
  未然に防いだ。

## 変更ファイル

コミット`7c7e19b`で92ファイルを新規追加・変更（`git show --stat
7c7e19b`で全量確認可能）。主要ディレクトリ：

```text
prisma/{schema.prisma,migrations/20260728070941_pr03a_admin_auth_foundation/,admin-bootstrap.ts}
packages/domain/src/admin-auth/**
packages/api-contracts/src/admin-auth/**
packages/config/src/env.ts
apps/api/src/infrastructure/config/api-config.module.ts
apps/api/src/bootstrap/configure-app.ts
apps/api/src/modules/admin-auth/**
apps/api/test/integration/{admin-auth-repository,admin-auth-api}.integration.spec.ts
apps/api/test/integration/{global-setup.ts,support/create-test-app.ts}
apps/api/src/{app.module.ts,main.ts}
apps/api/package.json（argon2/helmet/cookie-parser追加）
package.json（admin:bootstrapスクリプト、argon2/domain依存追加）
.github/workflows/ci.yml
.env.example
docs/architecture/{ADMIN_AUTH_POLICY,RBAC_POLICY}.md
docs/security/SESSION_COOKIE_CSRF_POLICY.md
docs/development/ADMIN_BOOTSTRAP.md
```

## 混入・健全性チェック（自己レビュー）

```bash
grep -rniE "sk-[a-z0-9]{10,}|api[_-]?key\s*=\s*['\"][a-z0-9]|password\s*=\s*['\"][^'\"]{3,}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|ci-bootstrap-password|correct-horse-battery" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.prisma" apps packages prisma .github
# → 該当なし（node_modules除く）。ヒットしたのはすべてテストコード内の
#   プレースホルダパスワード（"correct-horse-battery" = XKCD由来の
#   周知の非実在パスワード）または .github/workflows/ci.yml内の
#   使い捨てCI Postgresサービスコンテナ専用のBootstrap用テスト値のみ。
git check-ignore -v .env
# → .gitignore:16 で除外されていることを確認、git statusにも出現しない
grep -rli "php" apps packages prisma --include="*.ts" --include="*.tsx" --include="*.prisma"
# → 該当なし
grep -rliE "ai_art_member_id|LineIdentity|LIFFLogin|LineWebhook|代理店|教室|開催枠|予約|待機列|出席|利用権|StripeClient|画像生成|ObjectStorage|Wallet|Point" \
  apps/api/src/modules/admin-auth prisma/admin-bootstrap.ts packages/domain/src/admin-auth packages/api-contracts/src/admin-auth
# → 全ヒットは "Endpoint" の部分文字列マッチによる誤検知のみ
#   （実際の予約/決済/画像生成/Wallet機能への参照はなし）
```

- `packages/domain`の依存に`prisma`/`@nestjs/*`/`react`/`zod`/
  `argon2`/`cookie-parser`を含む項目なし（`domain-purity.test.ts`で
  構造的に検証、PR-03Aで追加した`admin-auth`モジュールも対象）。
- `apps/admin-web`への変更なし（実運用ログイン画面等は追加禁止 —
  section 12）。
- 旧PHP版（`team478a/ai-art-school`）は本セッションでは一切参照・
  clone・変更していない。
