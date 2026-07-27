# PR-02 テスト結果 (Test Results)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 対象PR

PR #2 https://github.com/stockbusiness/ai-art-platform/pull/2

## 作業ブランチ

`feat/pr-02-database-tenant-foundation`

## コミットSHA

`e32338b5c4d2e78017de4ad4d915b10484c5f53f`（追加修正4件の最終実装コミット。
提出物文書追加前）

## 環境

- Node.js: `v22.22.2`
- pnpm: `10.33.0`（Corepack `0.34.6`経由）
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

| Workspace                      | Test Files |  Tests |
| ------------------------------ | ---------: | -----: |
| @ai-art-platform/config        |          2 |      7 |
| @ai-art-platform/logger        |          1 |      2 |
| @ai-art-platform/domain        |          7 |     43 |
| @ai-art-platform/api-contracts |          3 |     10 |
| @ai-art-platform/database      |          1 |      1 |
| @ai-art-platform/ui            |          2 |      3 |
| @ai-art-platform/test-utils    |          1 |      2 |
| @ai-art-platform/api           |          6 |     17 |
| @ai-art-platform/worker        |          1 |      1 |
| @ai-art-platform/admin-web     |          1 |      2 |
| @ai-art-platform/liff-web      |          1 |      3 |
| **合計**                       |     **26** | **91** |

全件成功。前回提出（`3322f94`時点、71テスト）から、今回の追加修正
ラウンド（コミット`e32338b`）で`@ai-art-platform/domain`に20テスト
（1ファイル）を追加：

- `tenant-domain-host.test.ts`（新規、12テスト）: `TenantDomainHost`の
  正常値／多段サブドメイン／小文字正規化／大文字小文字を同一視する
  `.equals()`／空文字・空白のみ・スキーム・パス・ポート・不正文字・
  先頭ハイフン・末尾ハイフンの拒否
- `tenant.test.ts`への追加（8テスト）: `Tenant.create()`/`.rename()`の
  名前制約（空文字・空白のみ・121文字超の拒否、120文字ちょうど・
  1文字の許可、renameを空文字で拒否した際に元の名前が保持されること）

主な既存Unit Testの内容（PR-02本体実装時点から継続）：

- `TenantKey`: 正常値／短すぎる／長すぎる／大文字拒否／先頭・末尾ハイフン拒否
- `Tenant`: 新規作成／Status遷移（ACTIVE⇄SUSPENDED、同一遷移拒否）／rename
- `CreateTenantUseCase`/`UpdateTenantUseCase`/`ResolvePublicTenantByKeyUseCase`
  （in-memory repositoryを使用）
- `toTenantPublicResponse`: 内部UUIDが除外されることを確認
- `mapTenantErrorToHttp`: Domain Error→HTTPステータス・エラーコードの
  マッピング、DB接続詳細がエラーメッセージへ漏れないことを確認
- `domain-purity.test.ts`: `packages/domain`がPrisma/NestJS/React/Zod
  への依存を宣言していないことを構造的に確認

---

## 2. Integration Test結果

```bash
pnpm test:integration
```

| ファイル                                |  Tests | 内容                                                                                                                                                                                      |
| --------------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenant-repository.integration.spec.ts` |     25 | Tenant作成/取得/Key重複拒否/更新、TenantDomain作成/重複拒否/大文字小文字同一視/Primary重複拒否、Setting Upsert、Seed冪等性、DB-level CHECK制約（tenant_key/name/host、Raw SQL直接INSERT） |
| `public-tenant-api.integration.spec.ts` |      6 | `/health` 200、`/ready` 200、Tenant Resolve 200/400/404/403                                                                                                                               |
| `db-down.integration.spec.ts`           |      4 | DB完全到達不能状態でのフルアプリ起動：起動成功、`/health`=200、`/ready`=503、Public Tenant Resolve=503 `DATABASE_UNAVAILABLE`                                                             |
| `readiness.integration.spec.ts`         |      2 | `/ready` — DB到達不能で503、Migration未適用schemaで503                                                                                                                                    |
| **合計**                                | **37** | 全件成功                                                                                                                                                                                  |

前回提出（`3322f94`時点、16テスト）から、今回の追加修正ラウンド
（コミット`e32338b`）で21テストを追加：`tenant-repository.integration
.spec.ts`へ17テスト（DB-level CHECK制約11テスト、大文字小文字同一視
1テスト、TenantDomainHost化に伴う既存テストの型修正）、
`db-down.integration.spec.ts`を新規4テストで追加。

DB-level CHECK制約テストの詳細（`tenant-repository.integration.spec.ts`
の`describe("DB-level CHECK constraints...")`）：

- `tenants.tenant_key`：2文字/大文字混入/先頭ハイフン/末尾ハイフン/
  禁止文字（アンダースコア）をCHECK制約違反（SQLSTATE `23514`）で拒否、
  51文字を列型`VARCHAR(50)`制約（SQLSTATE `22001`）で拒否、有効な値は
  受理
- `tenants.name`：空文字／空白のみをCHECK制約違反で拒否
- `tenant_domains.host`：大文字混入／スキーム付き／パス付き／ポート付き／
  空文字／スペース混入をCHECK制約違反で拒否、有効な値は受理

いずれもPrisma/Domain層を経由せず`client.$executeRawUnsafe()`で直接
INSERTしており、Domain層をバイパスしてもDB自体が不正値を拒否することを
証明している。

### 実行方法（本セッションでの検証）

`TEST_DATABASE_URL`環境変数を、本セッションの実行環境に元々
インストールされていたネイティブPostgreSQL 16
（`postgresql://aiart:aiart_local@localhost:5432/ai_art_platform_test?schema=public`）
へ設定して実行した。理由：本セッションのサンドボックスはDocker Hubからの
イメージpullがネットワークポリシーによりブロックされており（`docker
compose up`で`postgres:16-alpine`取得が403で拒否）、Testcontainers
フォールバックパスも同じ理由で実行できなかった
（`OPEN_QUESTIONS_PR02.md`参照）。`TEST_DATABASE_URL`使用時は
Testcontainersを使わない設計のため、実際のPostgreSQL 16に対して
テストロジック自体は完全に検証できている。

CI（`database` job）はGitHub Actions標準のpostgresサービスコンテナを
使用しており、この制約の影響を受けない。CI上でも今回のコミット
（`e32338b`、37件）全件成功を確認済み（下記4節参照）。

---

## 3. Migration Test結果（指示書16.4）

追加修正ラウンド（コミット`e32338b`、CHECK制約3件を追加したMigration
SQLに対して）で再実行：

```bash
# 空DB（ai_art_platform_empty_test、新規作成）へ
DATABASE_URL=... DATABASE_DIRECT_URL=... npx prisma migrate deploy --schema prisma/schema.prisma
# → 成功（1 migration applied: 20260727101006_pr02_tenant_foundation）

# psql \d tenants / \d tenant_domains で3件のCHECK制約が存在することを確認
#   tenants_tenant_key_format_check / tenants_name_not_blank_check /
#   tenant_domains_host_format_check

# 同一DBへ再実行
DATABASE_URL=... DATABASE_DIRECT_URL=... npx prisma migrate deploy --schema prisma/schema.prisma
# → "No pending migrations to apply."（不整合なし）

# Seed ×2
DATABASE_URL=... DATABASE_DIRECT_URL=... pnpm db:seed   # 1回目
DATABASE_URL=... DATABASE_DIRECT_URL=... pnpm db:seed   # 2回目
# → tenants WHERE tenant_key='default' の行数 = 1（冪等性確認）

# DB破棄
DROP DATABASE ai_art_platform_empty_test;
```

全ステップ成功。空DBへの（CHECK制約3件を含む）Migration適用、2回目の
`migrate deploy`での不整合なし、Seedの冪等性、UNIQUE制約（Tenant Key
重複拒否／Domain重複拒否）、Primary Domain部分一意インデックス、および
今回追加した3件のCHECK制約の実機能（`psql`での構造確認、および
`tenant-repository.integration.spec.ts`のRaw SQL直接INSERTテストでの
機能確認）を確認した。

---

## 4. Ubuntu／Windows Quality CI 結果

GitHub Actions `.github/workflows/ci.yml`（`quality` job、matrix）。

コミット`e32338b`（追加修正4件）に対する実行：
https://github.com/stockbusiness/ai-art-platform/actions/runs/30261928922

| ステップ               | ubuntu-latest | windows-latest |
| ---------------------- | ------------- | -------------- |
| Checkout               | ✅            | ✅             |
| Enable Corepack        | ✅            | ✅             |
| Set up Node.js         | ✅            | ✅             |
| Install dependencies   | ✅            | ✅             |
| Generate Prisma Client | ✅            | ✅             |
| Validate Prisma schema | ✅            | ✅             |
| Check formatting       | ✅            | ✅             |
| Lint                   | ✅            | ✅             |
| Typecheck              | ✅            | ✅             |
| Test                   | ✅            | ✅             |
| Build                  | ✅            | ✅             |
| Clean build outputs    | ✅            | ✅             |

結果：`success`（両OS）。（前回提出時のコミット`4a39ef2`に対する実行
[run 30259221353](https://github.com/stockbusiness/ai-art-platform/actions/runs/30259221353)
も参考として過去に成功確認済み。）

## 5. Database CI 結果

同run（コミット`e32338b`、[run 30261928922](https://github.com/stockbusiness/ai-art-platform/actions/runs/30261928922)）内、
`database` job（`ubuntu-latest`のみ、`postgres:16-alpine`サービス
コンテナ使用）。

| ステップ                                  | 結果 |
| ----------------------------------------- | :--: |
| Checkout                                  |  ✅  |
| Enable Corepack                           |  ✅  |
| Set up Node.js                            |  ✅  |
| Install dependencies                      |  ✅  |
| Create isolated integration-test database |  ✅  |
| Generate Prisma Client                    |  ✅  |
| Validate Prisma schema                    |  ✅  |
| Deploy migrations                         |  ✅  |
| Seed                                      |  ✅  |
| Integration test（37件）                  |  ✅  |

結果：`success`。GitHub Actions runnerは本セッションのサンドボックスと
異なりDocker Hubへの通常アクセスが可能なため、`postgres:16-alpine`の
pull自体もCI上で問題なく成功している。

`continue-on-error`は使用していない。3 job（quality×2、database×1）の
いずれかが失敗すればワークフロー全体が失敗として報告される構成。

---

## 6. 真のClean Clone検証

### 実行方法（初回提出時、コミット`eef7ed7`）

作業ディレクトリとは別の一時ディレクトリへ、コミット`eef7ed7`時点の
`feat/pr-02-database-tenant-foundation`を`git clone`して検証（Linux環境）。

```bash
git clone --branch feat/pr-02-database-tenant-foundation \
  /home/user/ai-art-platform /tmp/.../ai-art-platform-pr02-clean
cd /tmp/.../ai-art-platform-pr02-clean
corepack enable
pnpm install --frozen-lockfile
DATABASE_URL=... DATABASE_DIRECT_URL=... pnpm db:generate
DATABASE_URL=... DATABASE_DIRECT_URL=... pnpm db:validate
pnpm format:check
pnpm lint
pnpm typecheck
DATABASE_URL=... DATABASE_DIRECT_URL=... pnpm test
pnpm build
pnpm clean
pnpm build   # 再ビルド
```

| 項目              | 値                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| OS                | Linux（コンテナ環境）                                                                               |
| Node.js version   | v22.22.2                                                                                            |
| pnpm version      | 10.33.0                                                                                             |
| Cloneしたコミット | `eef7ed77749e140e07c22aec8946ed0f5a4543d0`                                                          |
| 未追跡ファイル    | `node_modules`/`dist`/`.turbo`/`.env`/`packages/database/generated`いずれも存在しないことを確認済み |

### 結果（初回提出時、コミット`eef7ed7`）

全コマンド成功（71 unit test含む）。**この検証中に2件の実バグを発見**
（`pnpm db:validate`のDATABASE_URL不足、`pnpm test:integration`の
`TEST_DATABASE_URL`がTurborepo strict env modeで伝播しない問題）。
両方とも修正しコミット`4a39ef2`とし、修正後に同じClean Clone環境で
Database job相当のコマンド列（`db:migrate:deploy`→`db:seed`→
`test:integration`、16/16成功）を再実行して確認した。

### 実行方法（追加修正ラウンド、コミット`e32338b`、本ラウンドで再実施）

同様に別ディレクトリへ`e32338b`時点の`feat/pr-02-database-tenant-foundation`
を`git clone`して再検証した。

```bash
git clone --branch feat/pr-02-database-tenant-foundation \
  /home/user/ai-art-platform /tmp/.../clean-clone-pr02-round2
cd /tmp/.../clean-clone-pr02-round2
corepack enable
pnpm install --frozen-lockfile          # 成功
pnpm db:generate                        # 成功（.envへDB接続情報を配置）
pnpm db:validate                        # 成功
pnpm format:check                       # 成功
pnpm lint                               # 成功
pnpm typecheck                          # 成功
pnpm test                               # 成功（91テスト、26ファイル）
pnpm build                              # 成功（11/11 workspace）
TEST_DATABASE_URL=... pnpm --filter @ai-art-platform/api test:integration
# → 成功（37/37）
```

| 項目              | 値                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| OS                | Linux（コンテナ環境）                                                                               |
| Node.js version   | v22.22.2                                                                                            |
| pnpm version      | 10.33.0                                                                                             |
| Cloneしたコミット | `e32338b5c4d2e78017de4ad4d915b10484c5f53f`                                                          |
| 未追跡ファイル    | `node_modules`/`dist`/`.turbo`/`.env`/`packages/database/generated`いずれも存在しないことを確認済み |

全コマンド成功。今回のラウンドではClean Clone検証中に新たなバグは
発見されなかった（検証済みの3件の潜在バグは、いずれもClean Clone以前の
ローカル反復検証の段階で発見・修正済みだったため）。

### 未実施

- Windows環境でのClean Clone実機確認（Windows Quality CIでのcheckout・
  ビルド成功が代理指標）。
- Docker Hubへ到達可能な環境でのTestcontainersパス確認
  （`OPEN_QUESTIONS_PR02.md`参照）。

---

## 7. ルート`pnpm dev`同時起動確認（回帰）

PR-01で確立した4アプリ同時起動・単発SIGINT終了が、PR-02のDB依存追加後も
引き続き機能することを確認。

| 確認内容                                                   | 結果                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| `curl http://localhost:5173/`（admin-web）                 | ✅ 200                                                    |
| `curl http://localhost:5174/`（liff-web）                  | ✅ 200                                                    |
| `curl http://localhost:3000/`（api、PR-01互換）            | ✅ 200                                                    |
| `curl http://localhost:3000/health`                        | ✅ 200 `{"status":"ok"}`                                  |
| `curl http://localhost:3000/ready`                         | ✅ 200 `{"status":"ready"}`（DB migrate済み・seed済み時） |
| `curl http://localhost:3000/api/v1/public/tenants/default` | ✅ 200 `{"data":{"tenantKey":"default",...}}`             |
| workerログ                                                 | ✅ `"msg":"worker started"`                               |
| 単発SIGINT後の残存プロセス                                 | ✅ なし（`ps -ef`で確認）                                 |
| 単発SIGINT後のポート解放（3000/5173/5174）                 | ✅ すべて解放                                             |

---

上記7節はPR-02本体実装時点（`eef7ed7`）での確認記録であり、今回の
追加修正ラウンド（`e32338b`）では手動`curl`によるルート`pnpm dev`回帰の
再実行は行っていない。ただし、本ラウンドで変更した`PrismaService`の
起動時挙動（DB停止時の起動可否）自体は、手動curlよりも厳密な形で
`db-down.integration.spec.ts`（フルNestJSアプリ起動、DB到達不能設定）
によって検証済みである。

## 8. 混入・健全性チェック（再実施）

`IMPLEMENTATION_HISTORY_PR02.md`「混入・健全性チェック」節を参照
（Secret／PHP／対象外機能キーワードいずれも該当なし）。今回の追加修正
ラウンドで新規に扱った文字列（正規表現、SQLSTATEコード等）にも
Secret・PHP参照は含まれていない。

## 未実施のテスト（累積）

- Windows実機（開発者PC）でのローカル動作確認。
- macOS実機での動作確認。
- Docker Hubへ到達可能な環境でのTestcontainersパス実行確認。
- staging Supabaseへの接続・Migration適用（PR-02のスコープ外）。追加した
  3件のCHECK制約をstaging適用した場合の挙動も含めて未検証。
- 実LINE Channelとの接続（PR-02のスコープ外）。
- 追加修正ラウンドでのルート`pnpm dev`手動回帰の再実行（上記参照。
  `db-down.integration.spec.ts`による自動テストで代替検証済み）。
