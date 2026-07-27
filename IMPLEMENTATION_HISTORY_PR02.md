# PR-02 実装履歴 (Implementation History)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## Base Branch / Work Branch

- Base: `main`
- Work: `feat/pr-02-database-tenant-foundation`

## 作業開始前確認の結果

1. リポジトリ：`stockbusiness/ai-art-platform`で正しかった。
2. `main`の最新コミットは`d249280cc45aa8466018180e9a28cded79542191`
   （`PR-01: Repository and Monorepo Foundation (#1)`）で、これがPR-02の
   指示書に記載のPR-01マージコミットと一致することを確認した。
3. `git fetch origin main`で取得したリモート`main`と作業前のローカルの
   `main`に差分がないことを確認した（`d249280`より新しいコミットなし）。
4. `git status --porcelain`で未コミット変更がないことを確認した。
5. `feat/pr-02-database-tenant-foundation`を`main`から新規作成した
   （PR-01の作業ブランチは再利用していない）。
6. PR-01回帰確認：`pnpm build`/`pnpm test`/`pnpm lint`/`pnpm typecheck`
   を作業開始前に実行し、全11 workspaceが成功することを確認した
   （PR-01時点の25テストが全件成功）。

## 実装順序（時系列、指示書22章に対応）

1. `main`最新化・作業ブランチ作成（上記）。
2. PR-01回帰確認（上記）。
3. 第2章決定事項を設計文書化：`docs/architecture/ID_POLICY.md`、
   `docs/architecture/TENANT_POLICY.md`（`aiart:v2:{tenant_key}:{user_uuid}`
   形式、`common_user_id`のTenant単位一意制約、Tenant 1:N LINE Channel、
   UserはTenantごと別Row、Admin Role名の5決定を固定）。
4. `compose.yaml`作成（`postgres:16-alpine`、named volume、health check、
   `aiart`/`aiart_local`/`ai_art_platform`）。
5. Prisma導入：ルートに`prisma`（CLI）・`@prisma/client`をdevDependency
   として追加（後述の理由でルートにも必要と判明）。
6. `packages/database`作成（`createPrismaClient`ファクトリ、生成物の
   re-export のみ。業務ロジック・Domain参照なし）。
7. `prisma/schema.prisma`作成（`Tenant`/`TenantDomain`/`TenantSetting`、
   Generator出力先を`packages/database/generated/client`に設定）。
8. 初回Migration作成：ローカルNativePostgreSQL 16（後述）に対し
   `prisma migrate dev --name pr02_tenant_foundation`を実行し
   `20260727101006_pr02_tenant_foundation`を生成。Primary Domain一意制約
   （部分インデックス）をMigration SQLへ手動追加し、`prisma migrate reset`
   で再適用して動作確認。
9. `prisma/seed.ts`作成（`default` Tenantを冪等Upsert）。
10. `packages/config`のServer DB環境変数対応：`apiEnvSchema`
    （`DATABASE_URL`/`DATABASE_DIRECT_URL`必須）、`loadDotEnv`
    （`pnpm-workspace.yaml`を目印にリポジトリルートを探索し`.env`を
    `process.loadEnvFile`で読み込む。cwdに依存しない設計）。
11. `packages/logger`のredaction対象へDB接続文字列4種を追加。
12. `packages/domain/src/tenant/`作成（`Tenant`, `TenantKey`,
    `TenantStatus`, Domain Error群, `TenantRepository` port + DIトークン
    `TENANT_REPOSITORY`）。
13. `apps/api/src/modules/tenant/infrastructure/`に`PrismaTenantRepository`
    と Prisma↔Domainマッパーを作成。
14. Tenant UseCase作成（Create/GetById/ResolvePublicByKey/Update、いずれも
    `@Inject(TENANT_REPOSITORY)`でDI）。
15. Public Tenant Resolve API作成（`PublicTenantController`、Domain
    ErrorをHTTPステータス・エラーコードへマッピング）。
16. Health／Ready作成（`HealthController`は無条件200、`ReadyController`は
    `_prisma_migrations`テーブルを検査）。
17. Unit Test作成・実行（TenantKey/Tenant/UseCase/Mapper/Controller、
    fake in-memory repositoryを使用）。
18. Integration Test作成・実行（Repository/API/Readiness、詳細は下記）。
19. Migration Test実行（空DB→migrate deploy→再実行(no-op)→seed×2→
    integration test→DB破棄）。
20. CI拡張（`.github/workflows/ci.yml`のQuality jobへ`db:generate`/
    `db:validate`追加、新規`database` job作成）。
21. Clean Clone検証（別ディレクトリへの実clone、詳細は下記）。
22. README・設計文書更新。
23. 提出物7文書作成（本書含む）。
24. 自己レビュー（後述の混入・健全性チェック）。
25. Commit・Push（`eef7ed7`→`4a39ef2`→本コミット）。
26. Draft PR作成（PR #2）。

## 発生した問題と解決方法

### 1. Docker Hubからの`postgres:16-alpine` pullがこのセッションのサンドボックスでブロックされた

- 本セッションの実行環境は、Docker Hubのイメージ取得を含む一部の
  アウトバウンド通信がネットワークポリシーにより拒否される構成だった
  （プロキシへの CONNECT が403、ポリシー拒否と判定）。
- 対応：本セッションの検証には、同環境に元々インストール済みの
  **ネイティブPostgreSQL 16**（`postgresql-16`パッケージ、
  `compose.yaml`と同一のuser/password/db名で設定）を使用した。
  `compose.yaml`自体はDocker Composeの標準的な記法のままとし、Docker
  Desktopが使える通常の開発環境・CI環境（GitHub Actions）では問題なく
  動作する（実際、CIの`database` jobはGitHub Actions標準のpostgres
  serviceコンテナ機能を使っており、これはDocker Hubへの通常アクセスが
  可能なため、本コミットで正常に成功したことを確認済み）。
- Testcontainers（`pnpm test:integration`が`TEST_DATABASE_URL`未設定時に
  使うフォールバック経路）についても、同じDocker Hubブロックにより
  このセッション内では実行確認できなかった。`TEST_DATABASE_URL`を
  ネイティブPostgreSQLへ向けることで、統合テストのロジック自体は
  実際のPostgreSQL 16に対して完全に検証している。

### 2. `prisma validate`/`generate`がDB接続なしでも環境変数の存在を要求する

- Quality CI job（DBサービスを持たない）で`pnpm db:validate`を実行した
  ところ、`DATABASE_DIRECT_URL`が未設定というエラーで失敗することを
  Clean Clone検証で発見した。
- 原因：Prisma CLIは`env("DATABASE_URL")`等の解決を、実際の接続確立とは
  独立して行う（スキーマの`datasource`ブロック全体を解決する際に
  参照する環境変数の存在チェックが走る）。
- 対応：`.github/workflows/ci.yml`のQuality jobへダミー値の
  `DATABASE_URL`/`DATABASE_DIRECT_URL`を`env:`として追加（実際に接続は
  しない）。

### 3. Turborepo 2.xの既定strict env modeにより`TEST_DATABASE_URL`が伝播しない

- ローカルシェルで`TEST_DATABASE_URL`をexportした状態で`pnpm
test:integration`（`turbo run test:integration`）を実行したところ、
  統合テストがTestcontainersパスへ意図せずフォールバックし
  （`TEST_DATABASE_URL`が見えていない）、Docker Hubブロックにより失敗した。
- 原因：Turborepo 2.xは既定でstrict env modeであり、`turbo.json`の
  該当taskに明示されていない環境変数はタスクプロセスへ渡されない。
- 対応：`turbo.json`の`test:integration`タスクへ
  `"env": ["DATABASE_URL", "DATABASE_DIRECT_URL", "TEST_DATABASE_URL"]`
  を追加。

### 4. Prisma生成物がPrettier/ESLintの対象になっていた

- `pnpm format`を実行したところ、`packages/database/generated/`配下の
  Prisma生成JSファイル（数千行規模）がフォーマット対象となり、
  非常に時間がかかる上、`pnpm lint`では2000件超のエラーとなった。
- 対応：`.prettierignore`と`eslint.config.js`の`ignores`へ
  `packages/database/generated/**`を追加。生成物は`pnpm db:generate`で
  都度再生成されるため実害はないが、CI時間・シグナルノイズの観点から
  修正した。

### 5. NestJSのDIがVitestの既定トランスフォーム下で正しく動作しない

- `@nestjs/testing`の`Test.createTestingModule`でフルアプリを起動する
  統合テスト（`public-tenant-api.integration.spec.ts`等）が、
  `TENANT_NOT_FOUND`になるべき場面も含めすべて`503
DATABASE_UNAVAILABLE`を返す不具合が発生した。
- 原因調査：同一のテストシナリオを`ts-node/esm`（実TypeScriptコンパイラ）
  経由で手動実行したところDIが正しく解決され期待通りの結果を返すことを
  確認。一方Vitestの既定トランスフォーム（esbuildベース）では
  `emitDecoratorMetadata`が正しく機能せず、NestJSのコンストラクタ注入が
  暗黙に壊れていた。これは`OPEN_QUESTIONS_PR01.md`項目8で「業務Controller
  がDIの実行時契約を必要とする場合はSWC等の導入を検討されたい」と
  予告されていたリスクが、PR-02で実際に顕在化したもの。
- 対応：`unplugin-swc`（`.swcrc`で`decoratorMetadata: true`を設定）を
  `apps/api/vitest.integration.config.ts`にのみ導入。Unit Test
  （`vitest.config.ts`、Nestの実DIコンテナを経由しない）は既定の
  esbuildのままで問題ない。

### 6. Primary Domain制約違反のPrismaエラー判定ミス

- Raw SQLで追加した部分一意インデックス（Primary Domain制約）違反時、
  Prismaが返す`P2002`エラーの`meta.target`が`["host"]`のような
  制約名ではなく`["tenant_id"]`（カラム名）になることを、実際に
  違反を発生させて`console.log`で確認するまで判定ロジックに反映できて
  いなかった。修正し、コメントで理由を記録した。

## 追加修正ラウンド（コミット`e32338b`、指示書提出後のレビュー指摘4件）

ユーザーからPR #2に対し4件の追加修正指摘を受けた。指示は、Draft状態を
維持したまま同一ブランチへコミットを積み増すことだった（新規PR作成なし）。

### 実装順序

1. **Fix 1（DB停止時起動）**: `PrismaService`から`OnModuleInit`と
   `$connect()`呼び出しを削除。Prismaは初回クエリ時に遅延接続するため、
   これだけでDB停止時もアプリが起動する。`GET /ready`は既存の
   `ReadyController`が`_prisma_migrations`テーブルへクエリしており、
   DB未到達なら自然に503を返す（変更不要）。フルアプリ起動を伴う
   統合テスト`db-down.integration.spec.ts`を新規作成し、
   `DATABASE_URL`を到達不能な値（`localhost:1`）に差し替えて4パターン
   （アプリ起動確認、`/health`=200、`/ready`=503、Public Tenant Resolve
   =503 `DATABASE_UNAVAILABLE`）を検証。
2. **Fix 2 + Fix 3（DB CHECK制約）**: 未staging適用のMigration
   （`20260727101006_pr02_tenant_foundation/migration.sql`）へ直接
   3件のCHECK制約を追記（ユーザーから、新規Migrationではなく既存
   Migration SQLの直接編集が明示的に許可された）：
   `tenants_tenant_key_format_check`、`tenants_name_not_blank_check`、
   `tenant_domains_host_format_check`。`prisma migrate reset --force
--skip-seed`でローカルDBへ再適用し、`psql`の`\d`で制約の存在を確認。
3. **Fix 3（Domain層のHost検証）**: `packages/domain/src/tenant/
tenant-domain-host.ts`に`TenantDomainHost` Value Object
   を新規作成（private constructor + `static create()`が`Result`を
   返す既存パターンを踏襲）。`TenantRepository`の
   `CreateTenantDomainInput.host`の型を`string`から`TenantDomainHost`
   へ変更し、Repository実装（`PrismaTenantRepository`、
   `InMemoryTenantRepository`）とテストダブルを追従修正。これにより
   Repositoryは検証済みの`TenantDomainHost`しか受け取れない構造となり、
   「未検証の生文字列を永続化できない」という要件を型レベルで満たす。
4. **Fix 4（Tenant name制約）**: `Tenant`エンティティへ
   `assertValidTenantName()`を追加し、`create()`・`rename()`双方の
   冒頭で呼び出す。1〜120文字・空文字禁止・空白のみ禁止を
   `InvalidTenantNameError`で拒否。DB側は`tenants_name_not_blank_check`
   （空白のみ拒否）と既存の`VARCHAR(120)`型制約（上限）の組み合わせで
   担保。

### 検証中に発見・修正した3件の潜在バグ

いずれもユーザーからの直接指摘ではなく、上記4件を検証するテストを
書く過程で自己発見した：

1. **Raw SQL統合テストのUUID型キャスト漏れ**:
   `tenant_domains.host`のCHECK制約を検証するテストヘルパー
   `rawInsertTenantDomain`で、`tenant_id`（`uuid`型カラム）へ
   キャストなしで文字列を渡していたため`PrismaClientKnownRequestError`
   （Postgres `42804`、型不一致）で全件失敗した。`$1::uuid`の明示
   キャストで解消。
2. **アサーションが緩く、意図した失敗理由を検証できていなかった**:
   CHECK制約違反を期待するテストが`.rejects.toThrow()`のみだったため、
   UUID型キャストバグのような無関係な失敗もテストが「成功」として
   扱ってしまっていた。`meta.code === "23514"`（Postgres check_violation
   SQLSTATE）を厳密に検証する`expectCheckViolation()`ヘルパーへ強化。
3. **51文字tenant_keyの拒否経路がCHECK制約ではなく列型制約だった**:
   上記の厳密化後、51文字のtenant_keyのテストが失敗した。原因は
   `VARCHAR(50)`という列型自体がCHECK制約の正規表現評価より先に
   拒否する（SQLSTATE `22001`、"value too long for type character
   varying(50)"）ため。これ自体は意図通りの拒否だが、拒否経路が異なる
   ので、このケースだけ`23514`または`22001`のいずれも許容する
   `expectRejectedByDbConstraint()`という別ヘルパーへ切り出した。
4. **統合テストファイル間のクリーンアップ順序によるFK違反**:
   上記3件の修正を経て`pnpm test:integration`をフル実行したところ、
   `public-tenant-api.integration.spec.ts`側で6件が
   `Foreign key constraint violated: tenant_domains_tenant_id_fkey`
   で失敗した。原因：Vitestの統合テスト設定は`fileParallelism: false`
   のため全specファイルが同一DBを順番に共有するが、
   `public-tenant-api.integration.spec.ts`の`beforeEach`は`tenants`
   テーブルのみを削除しており、先に実行される
   `tenant-repository.integration.spec.ts`が新規追加したテストで
   `tenant_domains`行を残した状態のまま`tenants`を削除しようとして
   `ON DELETE RESTRICT`に阻まれていた。`tenant-repository.integration
.spec.ts`側は元々`tenantSetting`→`tenantDomain`→`tenant`の順で
   削除する`beforeEach`だったため、同じ順序を
   `public-tenant-api.integration.spec.ts`へも適用して解消。これは
   PR-02本体実装時点から存在した潜在的な構造ギャップで、本ラウンドで
   `tenant-repository.integration.spec.ts`側のテストが増えたことで
   初めて再現条件が揃った。

### 再検証結果（コミット`e32338b`、真のClean Clone環境）

`pnpm install --frozen-lockfile` / `db:generate` / `db:validate` /
`format:check` / `lint` / `typecheck` / `test`（91件、26ファイル）/
`build` / 空DBへのMigration適用 → 再実行no-op確認 → Seed×2冪等性確認 →
`test:integration`（37件、4ファイル）を全て別ディレクトリへの実clone
環境で再実行し、全件成功を確認した。詳細は`TEST_RESULTS_PR02.md`参照。

## 変更ファイル

コミット`eef7ed7`で86ファイルを新規追加・変更、`4a39ef2`で2ファイル修正、
`3322f94`で提出物7文書を追加、`e32338b`で追加修正4件（14ファイル）
（`git show --stat <SHA>`で全量確認可能）。主要ディレクトリ：

```text
compose.yaml
prisma/{schema.prisma,migrations/,seed.ts}
packages/database/**
packages/domain/src/tenant/**
packages/api-contracts/src/tenant/**
packages/config/src/{env.ts,dotenv.ts}
packages/logger/src/redaction.ts
apps/api/src/{health,infrastructure/database,modules/tenant}/**
apps/api/test/integration/**
apps/api/.swcrc / vitest.integration.config.ts
.github/workflows/ci.yml
.env.example / .gitignore / .prettierignore / eslint.config.js
package.json / turbo.json
docs/architecture/** / docs/database/** / docs/development/**
README.md
```

## 混入・健全性チェック（自己レビュー）

```bash
grep -rniE "sk-[a-z0-9]{10,}|api[_-]?key\s*=\s*['\"][a-z0-9]|password\s*=\s*['\"][^'\"]{3,}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.env*" --include="*.yml" --include="*.yaml" --include="*.prisma" .
# → 該当なし（node_modules配下の型定義コメントを除く）
git status --porcelain | grep -i "\.env$"
# → none
grep -rli "php" apps packages prisma --include="*.ts" --include="*.tsx" --include="*.prisma"
# → 該当なし
grep -rliE "argon2|bcrypt|jwt|StripeClient|LineClient|OutboxEvent|InboxEvent" apps packages prisma --include="*.ts"
# → 該当なし
```

- `packages/domain`の依存に`prisma`/`@nestjs/*`/`react`/`zod`を含む
  項目なし（`domain-purity.test.ts`で構造的に検証）。
- `packages/database/generated/`はgit追跡対象外（`.gitignore`で除外）。
- `.env`はコミットされていない（`.env.example`のみ、プレースホルダ値）。
