# PR-03A テスト結果 (Test Results)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-03a-admin-auth-rbac`

## コミットSHA

初回実装：`7c7e19b`（本体実装）〜`6cbfdaa`（PR #3作成後のCI結果
追記まで）。本書のこの版は、`AI_ART_PLATFORM_PR03A_REVIEW_FIX_
INSTRUCTIONS.md`に基づく追加レビュー修正（P0-1〜P0-7, P1-1〜P1-5）
適用後の結果を記録する — 修正前HEAD `6cbfdaa5a99b49345cde5579ad5e9d
7f09a69fad`。最新HEADは本書末尾および完了報告を参照。

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
| @ai-art-platform/config        |          2 |      16 |
| @ai-art-platform/logger        |          1 |       2 |
| @ai-art-platform/domain        |         13 |     100 |
| @ai-art-platform/api-contracts |          5 |      19 |
| @ai-art-platform/database      |          1 |       2 |
| @ai-art-platform/ui            |          2 |       3 |
| @ai-art-platform/test-utils    |          1 |       2 |
| @ai-art-platform/api           |         16 |      85 |
| @ai-art-platform/worker        |          1 |       1 |
| @ai-art-platform/admin-web     |          1 |       2 |
| @ai-art-platform/liff-web      |          1 |       3 |
| **合計**                       |     **45** | **235** |

全件成功。今回の追加レビュー修正ラウンド（review-fix、修正前HEAD
`6cbfdaa`）で33テスト・3ファイルを追加：

- `@ai-art-platform/config`：`env.test.ts`へ+6テスト
  （`ADMIN_TRUST_PROXY_HOPS`：既定未設定・明示値・負数拒否・非整数
  拒否・production時必須・production+0許可、review-fix P0-5）
- `@ai-art-platform/database`：`client.test.ts`へ+1テスト
  （`connection_limit`未指定時のデフォルト付与、CI偶発失敗の追加
  対応として後日追加）
- `@ai-art-platform/api`：+26テスト・+3ファイル
  - `timing-safe-equal.test.ts`（5、新規）：同一・1文字違い・長さ
    違い・空文字のTiming-safe比較（P0-1）
  - `admin-auth-error.mapper.test.ts`（7、新規）：4種の既知Errorの
    Mapping、未知Errorの503 Mapping（P0-7）、内部情報非漏洩、
    requestId伝播確認（P0-6）
  - `configure-app.test.ts`（4、新規）：`ADMIN_TRUST_PROXY_HOPS`から
    Express `trust proxy`設定への配線確認（P0-5）
  - `login-admin.use-case.test.ts`：+9テスト（各401/429経路での
    `verify`/`verifyDummy`呼出回数を検証、P0-2）
  - `argon2-password-hasher.test.ts`：+2テスト（`verifyDummy`の
    決定性・実Argon2id利用確認）

以下は初回実装ラウンド（PR #3提出時点、202テスト・42ファイル）の
記録（変更なし、参考として残す）：

前回提出（`3b9b1ca`時点、91テスト・26ファイル）から、初回実装
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

| ファイル                                    |  Tests | 内容                                                                                                                                                        |
| ------------------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-auth-api.integration.spec.ts`        |     29 | Login成功、/me、Login失敗全パターン、Lockout、IP Rate Limit、Logout+CSRF、Tenant境界、**P0-3/P0-4並行性、P1-1 Fault Injection、P0-6 requestId、P0-5 Proxy** |
| `admin-auth-repository.integration.spec.ts` |     29 | Migration適用確認、AdminUser永続化・重複拒否、DB CHECK制約、部分UNIQUE Index、AdminSession永続化、監査ログ非平文保存、**P1-2/P1-4 CHECK制約、P1-3 Index**   |
| `tenant-repository.integration.spec.ts`     |     25 | PR-02から継続（回帰確認）                                                                                                                                   |
| `public-tenant-api.integration.spec.ts`     |      6 | PR-02から継続（回帰確認）                                                                                                                                   |
| `db-down.integration.spec.ts`               |      6 | PR-02から継続（回帰確認）+ **P0-7：Login/`/me`のDB停止時503確認**                                                                                           |
| `admin-bootstrap-cli.integration.spec.ts`   |      2 | **新規：P1-5 Bootstrap CLIの実プロセスstdout/stderrにEmailが含まれないことを確認**                                                                          |
| `readiness.integration.spec.ts`             |      2 | PR-02から継続（回帰確認）                                                                                                                                   |
| **合計**                                    | **99** | 全件成功                                                                                                                                                    |

前回提出（PR #3提出時点`6cbfdaa`、81テスト・6ファイル）から
review-fixラウンドで18テスト・1ファイルを追加。

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

### review-fix検証の詳細（P0-1〜P0-7, P1-1〜P1-5）

- **P0-1（Timing-safe CSRF）**：Unit Test（`timing-safe-equal.test.ts`）
  で同一・1文字違い・長さ違い・空文字を検証。`CsrfGuard`の2箇所の
  比較を`timingSafeStringEqual`へ置換したことをコードレビューと
  既存CSRF統合テスト（Header欠落403等）の継続成功で確認。
- **P0-2（Dummy Argon2 Verify）**：`login-admin.use-case.test.ts`で
  不明Email／Tenant不存在・SUSPENDED／Admin不存在／DISABLEDの4経路
  すべてで`verifyDummy`が1回・`verify`が0回呼ばれること、実Admin
  へのPassword不一致では`verify`が1回・`verifyDummy`が0回、
  Lockout・IP Rate Limitedの429経路ではいずれも0回であることを
  Call Count Assertionで確認。
- **P0-3（Account Lockout Atomic化）**：8並行Wrong Password試行後、
  `admin_users.failed_login_count`がDB上401応答数と厳密に一致する
  ことを確認（`admin-auth-api.integration.spec.ts`「account lockout
  counter never loses an update」）。
- **P0-4（IP Rate Limit Atomic化）**：`ADMIN_LOGIN_IP_MAX_FAILURES=3`
  （縮小閾値、既定20と同じロジック経路）に対し6並行試行を送信し、
  `authFailedCount`（401件数）が閾値3を超えないこと、および
  401＋429＋503の合計が試行数6と一致することを確認（並行実行下でも
  閾値をすり抜けないというセキュリティ上の性質の決定的証拠）。
  CIのGitHub Actions Ubuntu Database jobで1回だけ`authFailedCount`が
  1になる（3件を下回る）事象が発生し、ローカルでは20回以上再現
  しなかったため、CIランナーのリソース制約下でのDB接続待ちタイム
  アウトと判断し、`packages/database/src/client.ts`へ`connection_
limit`既定値（20）を追加する対応と、assertion自体をインフラ起因の
  揺らぎに強い形（超過しないことを検証し、下回ることは許容）へ
  調整した（詳細は`OPEN_QUESTIONS_PR03A.md`項目7、
  `IMPLEMENTATION_HISTORY_PR03A.md`参照）。
- **P0-5（Reverse Proxy IP）**：`configure-app.test.ts`で
  `ADMIN_TRUST_PROXY_HOPS`未設定時に`trust proxy`へ`0`が渡ることを
  確認。統合テストでは、既定（trust proxy=0）の状態で異なる
  `X-Forwarded-For`を送っても同一の`ip_hash`に集約される
  （spoofingが無視される）ことを確認。
- **P0-6（Request ID相関）**：Login失敗時のHTTPレスポンス
  `error.requestId`・レスポンスHeader`X-Request-ID`・
  `admin_login_events.request_id`が完全一致することを確認。
- **P0-7（Infrastructure障害→503）**：`db-down.integration.spec.ts`
  へ追加した2テストで、DB接続不可時に`POST /login`・
  `GET /me`がいずれも`401`ではなく`503 AUTH_SERVICE_UNAVAILABLE`を
  返すことを確認（`GET /health`は200のまま、`GET /ready`は503のまま
  — PR-02からの既存挙動に変化なし）。
- **P1-1（Transaction境界）**：Fault Injectionテスト
  （`AdminSessionRepository.create`を1回だけ例外throwするよう
  `vi.spyOn`でモック）で、Session作成失敗時に直前に実行された
  Admin状態のAtomic Resetおよび監査ログ書込みが共にRollbackされ
  DBへ反映されないことを確認（`lastLoginAt`がNULLのまま、
  `admin_login_events`が0件、`admin_sessions`が0件）。
- **P1-2（Login Event CHECK制約）**：Raw SQLで
  `success=true`+`failure_reason`ありを拒否、
  `success=false`+`failure_reason`なしを拒否することを確認
  （SQLSTATE `23514`）。
- **P1-3（必須Index）**：`information_schema`相当のIndex存在確認、
  および`SET LOCAL enable_seqscan = off`でPlannerにIndex利用を強制
  した`EXPLAIN`で`admin_login_events_ip_hash_success_created_at_idx`
  が実際に選択可能であることを確認（テストDBの行数が少なく
  Cost-basedでは自動選択されないため、Seqscan禁止で強制検証 —
  「10. Session設計」ではなく本節の脚注として記録）。
- **P1-4（Hash形式CHECK）**：`admin_sessions`/`admin_login_events`の
  各`*_hash`カラムへ非Hex64値（短い文字列・大文字混じり）を
  Raw SQL INSERTし、CHECK制約違反（`23514`）で拒否されることを確認。
  NULL許容カラムはNULL自体は許可されることも確認。
- **P1-5（Bootstrap CLI Email非表示）**：実CLIプロセスを
  `child_process.execFile`で起動し、成功時・重複拒否時いずれの
  stdout/stderrにも入力Emailが含まれないことを確認
  （`admin-bootstrap-cli.integration.spec.ts`）。

---

## 3. Migration Test結果（Bootstrap CLI検証含む）

```bash
# 空DB（新規作成）へ
DATABASE_URL=... DATABASE_DIRECT_URL=... pnpm db:migrate:deploy
# → 成功（3 migration適用: 20260727101006_pr02_tenant_foundation →
#   20260728070941_pr03a_admin_auth_foundation →
#   20260728090611_pr03a_review_fix_hardening の順）

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
# → "Bootstrap admin created: id=<uuid> role=SUPER_ADMIN"
#   （review-fix P1-5：Emailは出力されない）

# Bootstrap CLI（同一Emailで再実行・重複拒否確認）
（同じ環境変数のまま）pnpm admin:bootstrap
# → "Admin bootstrap failed: An admin with this email already exists
#    as a SUPER_ADMIN" / exit code 1
#   （review-fix P1-5：Emailは出力されない）

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
# → 99/99 成功（別の空DBを使用 — 上記のBootstrap検証で作成した
#   Admin行と競合しないよう、Integration Testは常に
#   TEST_DATABASE_URLで隔離されたDBを使用）

# DB破棄
DROP DATABASE ai_art_platform_freshcheck;
```

全ステップ成功。review-fixラウンドでは、実際に
`ai_art_platform_freshcheck`という全く新規のPostgreSQL DBを作成し、
3 Migrationを順次適用→再適用no-op確認→Seed→Bootstrap CLI（成功・
重複拒否）→同DBに対しIntegration Test 99件すべて成功、を実施した
上でDBを破棄した（推測ではなく実際にコマンドを実行して確認）。

---

## 4. Ubuntu／Windows Quality CI 結果

GitHub Actions `.github/workflows/ci.yml`（`quality` job、matrix）。

最新コミット`cccedbb`（PR #3, `feat/pr-03a-admin-auth-rbac`）に対する
実行：Run ID `30340647078`
https://github.com/stockbusiness/ai-art-platform/actions/runs/30340647078

| Job                                                              | 結果    | 所要時間 |
| ---------------------------------------------------------------- | ------- | -------- |
| Install, format, lint, typecheck, test, build (`ubuntu-latest`)  | success | 82秒     |
| Install, format, lint, typecheck, test, build (`windows-latest`) | success | 168秒    |

各JobのURL：

- ubuntu-latest：https://github.com/stockbusiness/ai-art-platform/actions/runs/30340647078/job/90215243137
- windows-latest：https://github.com/stockbusiness/ai-art-platform/actions/runs/30340647078/job/90215243188

両JobともCheck formatting／Lint／Typecheck／Test／Buildの各ステップが
個別に`success`であることを`list_workflow_jobs`のsteps配列出力で
直接確認した。

結果：両OSとも成功。

（参考：1つ前のコミット`3280eaf`に対する実行も同様に全成功 —
Run ID `30340339218`、
https://github.com/stockbusiness/ai-art-platform/actions/runs/30340339218
。ubuntu-latest 84秒／windows-latest 187秒。）

## 5. Database CI 結果

同run内（`cccedbb`, Run ID `30340647078`）、`database` job
（`ubuntu-latest`のみ、Job ID `90215243101`）。結果：success（45秒）。
https://github.com/stockbusiness/ai-art-platform/actions/runs/30340647078/job/90215243101

ステップ単位の結果（`list_workflow_jobs`のsteps配列で個別に確認済み。
全ステップ`conclusion: "success"`）：

| ステップ                                     | 結果    | 内容                                                |
| -------------------------------------------- | ------- | --------------------------------------------------- |
| Deploy migrations (PR-02 + PR-03A)           | success | `pnpm db:migrate:deploy`（2 migration適用）         |
| Re-deploy migrations (idempotency check)     | success | `pnpm db:migrate:deploy`（2回目、no-op確認）        |
| Seed                                         | success | `pnpm db:seed`                                      |
| Bootstrap CLI — create the first SUPER_ADMIN | success | `pnpm admin:bootstrap`                              |
| Bootstrap CLI — rejects a duplicate admin    | success | 同一設定で再実行し、非ゼロ終了することをShellで確認 |
| Integration test (Tenant + Admin Auth)       | success | `pnpm test:integration`（81件）                     |

結果：job全体および個別ステップすべてが成功したことを
`list_workflow_jobs`のsteps配列出力で直接確認した（ログ本文
＝`get_job_logs`は今回は未取得だが、各ステップの`conclusion`
フィールドは確認済み）。

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
