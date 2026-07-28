# PR-03A テスト結果 (Test Results)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-03a-admin-auth-rbac`

## コミットSHA

`7c7e19b`（本体実装コミット。ローカル検証・Clean
Clone検証はこの時点で実施）。CI実行・PR作成は`3280eaf`（提出物文書
追加後の最終コミット）に対して行った — 4節・5節のCI結果は
`3280eaf`のもの。

## 環境

- Node.js: `v22.22.2`
- pnpm: `10.33.0`（Corepack経由）
- Prisma: `5.22.0`
- PostgreSQL: `16`（ローカル検証：ネイティブインストール済みPostgreSQL
  16.13。CI：`postgres:16-alpine`）
- ローカル検証OS: Linux（コンテナ環境）
- CI検証OS: `ubuntu-latest`、`windows-latest`（GitHub Actions）

---

## 1. Unit Test結果

```bash
pnpm test
```

| Workspace                      | Test Files |   Tests |
| ------------------------------ | ---------: | ------: |
| @ai-art-platform/config        |          2 |      10 |
| @ai-art-platform/logger        |          1 |       2 |
| @ai-art-platform/domain        |         13 |     100 |
| @ai-art-platform/api-contracts |          5 |      19 |
| @ai-art-platform/database      |          1 |       1 |
| @ai-art-platform/ui            |          2 |       3 |
| @ai-art-platform/test-utils    |          1 |       2 |
| @ai-art-platform/api           |         13 |      59 |
| @ai-art-platform/worker        |          1 |       1 |
| @ai-art-platform/admin-web     |          1 |       2 |
| @ai-art-platform/liff-web      |          1 |       3 |
| **合計**                       |     **42** | **202** |

全件成功。前回提出（`3b9b1ca`時点、91テスト・26ファイル）から、本
ラウンドで111テスト・16ファイルを追加：

- `@ai-art-platform/domain`：+57テスト・+6ファイル
  - `admin-email.test.ts`（10）：正規化・不正Email拒否・254文字超過拒否
  - `admin-name.test.ts`（6）：空白拒否・120文字超過拒否
  - `password-policy.test.ts`（8）：11/129文字拒否・空白のみ拒否・
    Email同一拒否・非trim検証
  - `admin-user.test.ts`（12）：Role/tenant_id整合性・Permission
    委譲・Lockout（閾値到達・解除・成功時リセット）
  - `admin-session.test.ts`（14）：expiresAt計算・Expired判定・
    Revoked判定（冪等性含む）・CSRF Token Hash比較・touch間隔判定
  - `role-permission-map.test.ts`（7）：Permission Matrix全Role検証
- `@ai-art-platform/api-contracts`：+9テスト・+2ファイル
  - `admin-login-request.schema.test.ts`（5）
  - `admin-summary.schema.test.ts`（4、passwordHash等の非漏洩確認含む）
- `@ai-art-platform/config`：既存`env.test.ts`へ+3テスト追加
  （admin-auth環境変数のデフォルト値・必須検証）
- `@ai-art-platform/api`：+42テスト・+8ファイル
  - `login-admin.use-case.test.ts`（15）：Tenant/SUPER_ADMIN別ログイン
    成功、あらゆる失敗が同一Generic Error、Lockout・IP Rate
    Limit、監査ログの平文非保存
  - `authenticate-session.use-case.test.ts`（8）：Session有効/無効の
    全パターン、Tenant SUSPENDED時のForbidden、touch間隔制御
  - `logout-admin.use-case.test.ts`（3）：revoke・冪等性
  - `get-current-admin.use-case.test.ts`（1）：Session内部情報の非漏洩
  - `argon2-password-hasher.test.ts`（5）：実Argon2idによるHash/Verify
  - `crypto-session-token.service.test.ts`（5）：実SHA-256による
    Token生成・Hash
  - `request-fingerprint.test.ts`（5）：実HMAC-SHA256による
    IP/Email Hash

---

## 2. Integration Test結果

```bash
pnpm test:integration
```

| ファイル                                    |  Tests | 内容                                                                                                                            |
| ------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------- |
| `admin-auth-api.integration.spec.ts`        |     24 | Login成功（Tenant/SUPER_ADMIN）、/me、Login失敗全パターン（同一Generic Error）、Lockout、IP Rate Limit、Logout+CSRF、Tenant境界 |
| `admin-auth-repository.integration.spec.ts` |     20 | Migration適用確認、AdminUser永続化・重複拒否、DB CHECK制約6種、部分UNIQUE Index、AdminSession永続化、監査ログ非平文保存         |
| `tenant-repository.integration.spec.ts`     |     25 | PR-02から継続（回帰確認）                                                                                                       |
| `public-tenant-api.integration.spec.ts`     |      6 | PR-02から継続（回帰確認）                                                                                                       |
| `db-down.integration.spec.ts`               |      4 | PR-02から継続（回帰確認）                                                                                                       |
| `readiness.integration.spec.ts`             |      2 | PR-02から継続（回帰確認）                                                                                                       |
| **合計**                                    | **81** | 全件成功                                                                                                                        |

前回提出（`3b9b1ca`時点、37テスト・4ファイル）から44テスト・2ファイル
を追加。

### Admin Auth API Integration Testの詳細（section 13.3準拠）

- **Login成功**：Tenant管理者／SUPER_ADMIN、Cookie属性
  （`HttpOnly`/`SameSite=Lax`/`Max-Age`をSession Cookieに、
  非`HttpOnly`をCSRF Cookieに確認）、`/me` 200、Login Event成功記録、
  失敗後の`failed_login_count`リセット。
- **Login失敗**（すべて同一`401 AUTHENTICATION_FAILED`）：不明
  tenantKey、不明Email、Password不一致、DISABLED、Tenant SUSPENDED、
  tenantKeyなしでTenant管理者検索（SUPER_ADMINへフォールバックしない
  ことを確認）、tenantKeyありでSUPER_ADMIN検索（Tenant管理者へ
  フォールバックしないことを確認）、不正なRequest Body。
- **Lockout**：`ADMIN_LOGIN_ACCOUNT_MAX_FAILURES`（既定5）到達後、
  正しいPasswordでも`429 TOO_MANY_ATTEMPTS`。
- **IP Rate Limit**：`ADMIN_LOGIN_IP_MAX_FAILURES`（既定20）到達後、
  異なるEmailでの試行でも同一IPからは`429`。
- **Session/CSRF**：Cookieなし401、改ざんCookie401、Logout後Session
  無効401、**同一Logout再送は401で安全に失敗**（設計判断：
  `AdminAuthGuard`がRevoked済みSessionを一律401拒否するため、2回目の
  Logout要求はGuard段階で拒否される。これは仕様書の「同一Logout再送は
  安全に処理する」を、クラッシュや500を起こさない、外部情報を漏らさ
  ない、という意味で満たす設計として実装した — 詳細は
  `docs/security/SESSION_COOKIE_CSRF_POLICY.md`参照）、
  CSRF Header欠落403、CSRF Cookie欠落403、Header/Cookie不一致403、
  一致時Logout成功204。
- **Tenant境界**：同一EmailをTenant A/Bへ作成→各TenantKeyで正しい方の
  Tenantへログイン、`/me`へBody/Query/HeaderでTenant IDを注入しても
  Session由来のTenant Contextが変わらないことを確認。

### DB統合テストの詳細

- Migration適用済みテーブル（`admin_users`/`admin_sessions`/
  `admin_login_events`）へのクエリ成功で構造の存在を確認。
- Role/tenant_id整合性（Tenant Roleでtenant_id NULL拒否、SUPER_ADMINで
  tenant_id NOT NULL拒否）をRaw SQL直接INSERTで検証。
- 大文字Email・前後空白Email・空白Name・負のfailed_login_countを
  CHECK制約違反（SQLSTATE `23514`）で拒否することを確認。
- 同一Tenant内の重複Email拒否、別Tenantの同一Email許可、SUPER_ADMIN
  重複Email拒否、Tenant管理者とSUPER_ADMINの同一Email許可を
  Repository経由（`AdminAlreadyExistsError`）で確認。
- `admin_sessions.token_hash`のUNIQUE制約違反を確認。
- `admin_login_events`にEmail・IP・User-Agentの平文が一切含まれない
  ことをJSON文字列化して`not.toContain`で確認。IP単位の時間窓カウント
  （`countRecentFailuresByIpHash`）が窓外・別IP・成功イベントを正しく
  除外することを確認。

---

## 3. Migration Test結果（Bootstrap CLI検証含む）

```bash
# 空DB（新規作成）へ
DATABASE_URL=... DATABASE_DIRECT_URL=... pnpm db:migrate:deploy
# → 成功（2 migration適用: 20260727101006_pr02_tenant_foundation →
#   20260728070941_pr03a_admin_auth_foundation の順）

# 同一DBへ再実行
DATABASE_URL=... DATABASE_DIRECT_URL=... pnpm db:migrate:deploy
# → "No pending migrations to apply."（不整合なし）

# Seed
DATABASE_URL=... DATABASE_DIRECT_URL=... pnpm db:seed
# → 成功（"default" Tenant冪等Upsert）

# Bootstrap CLI（初回・成功）
BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... \
BOOTSTRAP_ADMIN_NAME=... BOOTSTRAP_ADMIN_ROLE=SUPER_ADMIN \
pnpm admin:bootstrap
# → "Bootstrap admin created: ...@example.com (SUPER_ADMIN)"

# Bootstrap CLI（同一Emailで再実行・重複拒否確認）
（同じ環境変数のまま）pnpm admin:bootstrap
# → "Admin bootstrap failed: An admin with email "..." already exists
#    as a SUPER_ADMIN" / exit code 1

# Bootstrap CLIのバリデーション確認
# - SUPER_ADMIN + BOOTSTRAP_TENANT_KEY設定 → 失敗
#   ("BOOTSTRAP_TENANT_KEY must not be set when
#     BOOTSTRAP_ADMIN_ROLE=SUPER_ADMIN")
# - TENANT_OWNER + BOOTSTRAP_TENANT_KEY未設定 → 失敗
#   ("BOOTSTRAP_TENANT_KEY is required when
#     BOOTSTRAP_ADMIN_ROLE=TENANT_OWNER")
# - TENANT_OWNER + 存在しないTenantKey → 失敗
#   ('Tenant "does-not-exist" was not found')
# - TENANT_OWNER + 有効なTenantKey('default') → 成功
#   ("Bootstrap admin created: owner@example.com (TENANT_OWNER,
#     tenant \"default\")")

# 同一DBに対しIntegration Testを実行
TEST_DATABASE_URL=... pnpm --filter @ai-art-platform/api test:integration
# → 81/81 成功（別の空DBを使用 — 上記のBootstrap検証で作成した
#   Admin行と競合しないよう、Integration Testは常に
#   TEST_DATABASE_URLで隔離されたDBを使用）

# DB破棄
DROP DATABASE ai_art_platform_ci_check;
```

全ステップ成功。空DBへのPR-02→PR-03A順次Migration適用、2回目の
`migrate deploy`での不整合なし、Bootstrap CLIの成功・重複拒否・
バリデーション全パターンを確認した。

---

## 4. Ubuntu／Windows Quality CI 結果

GitHub Actions `.github/workflows/ci.yml`（`quality` job、matrix）。

コミット`3280eaf`（PR #3, `feat/pr-03a-admin-auth-rbac`）に対する実行：
Run ID `30340339218`
https://github.com/stockbusiness/ai-art-platform/actions/runs/30340339218

| Job                                                              | 結果    | 所要時間 |
| ---------------------------------------------------------------- | ------- | -------- |
| Install, format, lint, typecheck, test, build (`ubuntu-latest`)  | success | 84秒     |
| Install, format, lint, typecheck, test, build (`windows-latest`) | success | 187秒    |

各JobのURL：

- ubuntu-latest：https://github.com/stockbusiness/ai-art-platform/actions/runs/30340339218/job/90214279336
- windows-latest：https://github.com/stockbusiness/ai-art-platform/actions/runs/30340339218/job/90214279384

結果：両OSとも成功
（`mcp__github__pull_request_read` `get_check_runs`にて
`conclusion: "success"`を確認、2026-07-28実行分）。

## 5. Database CI 結果

同run内、`database` job（`ubuntu-latest`のみ、Job ID
`90214279316`）。結果：success（50秒）。
https://github.com/stockbusiness/ai-art-platform/actions/runs/30340339218/job/90214279316

今回追加したステップ：

| ステップ                                     | 内容                                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Deploy migrations (PR-02 + PR-03A)           | `pnpm db:migrate:deploy`（2 migration適用）                 |
| Re-deploy migrations (idempotency check)     | `pnpm db:migrate:deploy`（2回目、no-op確認）                |
| Seed                                         | `pnpm db:seed`                                              |
| Bootstrap CLI — create the first SUPER_ADMIN | `pnpm admin:bootstrap`（成功が必須。失敗時はjob失敗）       |
| Bootstrap CLI — rejects a duplicate admin    | 同一設定で再実行し、失敗（非ゼロ終了）することをShellで確認 |
| Integration test (Tenant + Admin Auth)       | `pnpm test:integration`（81件）                             |

結果：job全体が成功したことを確認済み（`conclusion: "success"`）。
個別ステップのログ本文（`get_job_logs`）はGitHub Actions
UIでのみ閲覧可能で、本書はjob全体の結果として記録している —
job結果が成功である以上、シェル側の
`if pnpm admin:bootstrap; then exit 1; fi`
アサーションを含む全ステップが成功したことはjobの成功によって
保証される（個別ステップのログ本文までは未確認。詳細は「23.
未実施項目」参照）。

---

## 6. 真のClean Clone検証

### 実行方法

作業ディレクトリとは別の一時ディレクトリへ、コミット`7c7e19b`時点の
`feat/pr-03a-admin-auth-rbac`を`git clone`して検証（Linux環境）。

```bash
git clone --branch feat/pr-03a-admin-auth-rbac \
  /home/user/ai-art-platform /tmp/.../clean-clone-pr03a
cd /tmp/.../clean-clone-pr03a
corepack enable
pnpm install --frozen-lockfile          # 成功
pnpm db:generate                        # 成功
pnpm db:validate                        # 成功
pnpm format:check                       # 成功
pnpm lint                               # 成功
pnpm typecheck                          # 成功
pnpm test                               # 成功（202テスト、42ファイル）
pnpm build                              # 成功（11/11 workspace）
TEST_DATABASE_URL=...（空DB）pnpm --filter @ai-art-platform/api test:integration
# → 成功（81/81、PR-02→PR-03Aの順にMigration適用してから実行）
```

### 記録項目

| 項目              | 値                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| OS                | Linux（コンテナ環境）                                                                               |
| Node.js version   | v22.22.2                                                                                            |
| pnpm version      | 10.33.0                                                                                             |
| Cloneしたコミット | `7c7e19b`                                                                                           |
| 未追跡ファイル    | `node_modules`/`dist`/`.turbo`/`.env`/`packages/database/generated`いずれも存在しないことを確認済み |

### 結果

全コマンド成功。このラウンドではClean Clone検証中に新たなバグは
発見されなかった（`argon2`のprebuild動作確認・admin-auth関連の統合
テスト・全ユニットテストを含め、Clean Clone以前のローカル反復検証の
段階で発見していた事項の再発はなかった）。

### 未実施

- Windows環境でのClean Clone実機確認（Windows Quality CIでのcheckout・
  ビルド成功が代理指標、PR-02から継続）。
- Docker Hubへ到達可能な環境でのTestcontainersパス確認
  （`OPEN_QUESTIONS_PR03A.md`参照、PR-02から継続する既知の制約）。

---

## 7. 混入・健全性チェック

`IMPLEMENTATION_HISTORY_PR03A.md`「混入・健全性チェック」節を参照
（Secret／PHP／PR-04以降機能キーワードいずれも実質的な該当なし —
"Endpoint"の部分文字列マッチによる誤検知のみ）。

## 未実施のテスト（累積）

- Windows実機（開発者PC）でのローカル動作確認。
- macOS実機での動作確認。
- Docker Hubへ到達可能な環境でのTestcontainersパス実行確認。
- staging Supabaseへの接続・Migration適用（PR-03Aのスコープ外）。
- Account Lockoutの実時間経過後の解除確認（ドメイン層Unit Testで
  `FixedAuthClock`により論理検証済みだが、API統合テストでは900秒の
  実待機を伴う検証は行っていない）。
- Windowsブラウザでの`SameSite=Lax`／`Secure`Cookie挙動の実機確認
  （PR-03B「Admin Web Login」実装時に確認予定）。
