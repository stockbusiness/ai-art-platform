# PR-03A 未決事項 (Open Questions)

対象リポジトリ: `stockbusiness/ai-art-platform`
作業ブランチ: `feat/pr-03a-admin-auth-rbac`

本書は、PR-03A（Admin Authentication, Session and RBAC Foundation）の
実装中に発生した、推測で進めなかった事項・記録が必要な決定事項を
まとめる。

## 1. 「同一Logout再送は安全に処理する」の解釈（決定・記録）

- 指示書section 7.3は「同一Logout再送は安全に処理する」とのみ記載し、
  2回目のHTTP Statusを明示していない。
- 決定：`AdminAuthGuard`はSessionの有効性（未Revoke・未期限切れ）を
  すべての保護Routeで一律に検証する設計とした。1回目のLogoutで
  Sessionが既にRevokeされているため、2回目のLogout要求は
  `AdminAuthGuard`の段階で`401 UNAUTHENTICATED`として拒否される。
- 根拠：「安全に処理する」を「クラッシュ・500エラー・情報漏洩を
  起こさず、Well-definedなエラーとして扱われる」という意味で解釈した。
  `LogoutAdminUseCase`自体は独立して冪等に実装済み（未知のTokenを
  渡されても例外を投げずに正常終了する）だが、Guardの一律な検証方針を
  崩さない設計を優先した。
- 次PRへの引継ぎ：もし「2回目も204を返すべき」という異なる意図で
  あった場合、Logout Endpointのみを`AdminAuthGuard`の外側で扱う
  （Session検証を`LogoutAdminUseCase`内に閉じ込め、Guardをバイパス
  する）設計変更が必要になる。統合テストで現在の挙動
  （`admin-auth-api.integration.spec.ts`の「a second logout with the
  same (now-revoked) cookie fails safely with 401」）を明示的に
  文書化しているため、変更する場合はこのテストごと見直すこと。

## 2. Lockout・IP Rate Limitの実時間経過後の解除挙動（記録・部分検証済み）

- Account Lockout（`ADMIN_LOCKOUT_SECONDS`経過後の自動解除）は
  `packages/domain/src/admin-auth/admin-user.test.ts`で
  `FixedAuthClock`を使い論理的に検証済み（`isLocked(now)`が
  Lockout期間経過後に`false`を返すことを確認）。
- API統合テストでは、900秒（既定値）の実待機を伴う「Lockout解除後に
  再ログインできること」の検証は行っていない（テスト実行時間の都合）。
- 次PRへの引継ぎ：`AuthClock`portを利用してテスト専用の時間操作可能な
  Clock実装をNest DIへ差し込む統合テスト用の仕組みを用意すれば、
  実待機なしでAPI層でも検証可能になる。現時点ではドメイン層の
  Unit Testでロジックの正しさを担保している。

## 3. Testcontainersパスの本セッション内未検証（PR-02から継続、記録）

- PR-02の`OPEN_QUESTIONS_PR02.md`項目2と同一の制約がPR-03Aでも継続。
  本セッションの実行環境はDocker Hubからのイメージpullがネットワーク
  ポリシーにより拒否されるため、`TEST_DATABASE_URL`未設定時の
  Testcontainersフォールバックパス自体は本PRでも検証できていない。
- 実際の統合テスト（81件）は`TEST_DATABASE_URL`をネイティブ
  PostgreSQL 16へ向けることで検証した。CIの`database` jobはGitHub
  Actions標準のpostgres serviceコンテナを使用しており、Testcontainers
  には依存しない設計のため、CI上の検証は実施できている。

## 4. `AUTH_IP_HASH_SECRET`の運用方針（部分決定・staging以降は未決）

- 決定（本PR内）：ローカル開発・CIでは`.env.example`／CI変数として
  非機密のプレースホルダ値を使用する。`packages/logger`の
  `SENSITIVE_KEYS`へ追加し、誤ってログへ出力されないよう防御した。
- 未決（本PRのスコープ外）：staging/production環境での
  `AUTH_IP_HASH_SECRET`の実際の発行・ローテーション・保管方法
  （Secret Manager等）は、指示書1.3節の「Supabaseの実プロジェクト
  情報」等と同様、本書では推測実装せず未決のままとする。

## 5. `AdminTenantGuard`は本PRでは未使用（記録）

- section 9で要求された`tenant.guard.ts`は実装したが、PR-03Aで
  公開する3 Endpoint（`/login`, `/me`, `/logout`）はいずれも
  Tenant-scoped Resource（他Tenantのデータを一覧・操作するもの）では
  ないため、実際のRouteへ`@UseGuards(AdminTenantGuard)`を適用する
  箇所が存在しない。
- 対応：`AdminTenantGuard`の単体ロジック自体は将来のTenant-scoped
  Endpoint実装に備えて実装済みとし、コード内コメントで意図を明記した。
- 次PRへの引継ぎ：Tenant-scoped Resource Endpoint（例：Tenant設定
  一覧・Admin一覧等）を追加する際は、必ずこのGuardを経由し、
  Body/Query/Header由来の`tenantId`を信用しない設計を踏襲すること。

## 6. `admin:manage` Permissionは定義済みだが使用箇所なし（section 3.6記載通り、記録）

- `ROLE_PERMISSIONS`に`admin:manage`（`SUPER_ADMIN`/`TENANT_OWNER`が
  保有）を定義したが、これを要求するAdmin作成・編集APIは指示書の
  明示的な指定通り本PRでは公開していない。
- 次PRへの引継ぎ：PR-03B以降でAdmin管理APIを実装する際、
  `@RequirePermissions("admin:manage")`をそのまま適用できる設計と
  なっている。

## 7. 極端に大きい同一IP同時バーストでのDB接続プール枯渇（review-fix、記録・部分対応）

- 発見経緯：P0-4（IP単位Rate LimitのAtomic化）の並行Integration
  Testを作成する過程で、既定の`ADMIN_LOGIN_IP_MAX_FAILURES=20`に対し
  25件を完全同時（`Promise.all`）に送信すると、複数件が`503
AUTH_SERVICE_UNAVAILABLE`を返すことを確認した（本来期待される
  401/429ではなく）。
- 原因：`pg_advisory_xact_lock`による同一IP直列化そのものは正しく
  機能しているが、ロック待機中の各Transactionは（作業していなくても）
  Postgres接続を1本ずつ保持し続けるため、Prismaの既定接続プール
  （`num_cpus * 2 + 1` — 本検証環境では4 CPU→9接続）を超える人数が
  完全同時に到達すると、接続待ちがPrismaの`$transaction`の
  `maxWait`/`timeout`を超過し、エラーとして跳ね返る。
- 本PRでの対応：`PrismaDbTransactionService`の`$transaction`
  `maxWait`/`timeout`を既定（2000ms/5000ms）から10000ms/15000msへ
  拡大し、多少のバーストには耐えるようにした。
- 未対応（本PRのスコープ外、次PRへの引継ぎ）：接続プールサイズ
  自体の拡大（`DATABASE_URL`の`connection_limit`）、またはArgon2
  Verify（実/Dummyとも）をLock保持Transactionの外へ移す設計変更
  （P0-4のCheck-then-Record原子性を壊さない形での再設計が必要 —
  本PRでは時間的制約により見送った）が必要。
- 統合テストでの扱い：`admin-auth-api.integration.spec.ts`の
  P0-4並行テストは、この接続プール制約を回避するため
  `ADMIN_LOGIN_IP_MAX_FAILURES=3`・6並行という縮小規模で実施し、
  「並行要求が閾値をすり抜けない」という正しさの性質そのものは
  確定的に検証している（縮小規模はインフラ制約を避けるためであり、
  検証している性質は既定の閾値20でも同一）。既定閾値20・大規模
  バーストでの完全な安定動作は、上記の接続プール拡大を行った上で
  別途再検証することを推奨する。

## 8. PR-02で決着済みの事項（継続、参考情報）

`OPEN_QUESTIONS_PR02.md`に記載の事項（Testcontainers、NestJS DIと
Vitestのesbuildトランスフォーム非互換、`turbo.json`のenv宣言運用等）は
PR-03Aでも同じ構造・同じ対応方針を踏襲しており、新たな決定は発生して
いない。
