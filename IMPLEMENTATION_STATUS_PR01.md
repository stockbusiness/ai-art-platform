# PR-01 実装状況 (Implementation Status)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-01-monorepo-foundation`（ベースブランチ: `main`）

## コミットSHA

- 初期化コミット（`main`）: `d468849`（空コミット、リポジトリ初期化のみ）
- 実装コミット（本ブランチ）: `5d19362718af20a4894c84a0267588c67c03b454`

## スコープ

`AI_ART_PLATFORM_REDESIGN_MASTER_PLAN_PR01.md` 11章「PR-01 Repository and
Monorepo Foundation」のみを実装した。業務機能（テナント、認証、LINE、
画像生成、予約、決済、利用権、ガチャ等）は一切実装していない。

## 実装内容サマリ

| 区分                   | 内容                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                | Node.js 22系（`.nvmrc`）、pnpm 10.33.0（`packageManager`固定）、Corepack前提                                                                   |
| Monorepo               | pnpm workspace（`apps/*`, `packages/*`）、Turborepo（`turbo.json`：dev/build/lint/typecheck/test/format/format:check/clean）                   |
| apps/admin-web         | React + TypeScript + Vite。Router雛形（`/`, `*`）。Build情報表示。Vitest smoke test                                                            |
| apps/liff-web          | React + TypeScript + Vite。Router雛形（`/`, `/auth/callback`, `/maintenance`）。LINE SDK本接続なし。Vitest smoke test                          |
| apps/api               | NestJS。`GET /` は開発情報のみ返却。DB接続なし。業務Controllerなし。Vitest unit smoke test                                                     |
| apps/worker            | Node standalone（NestJS不使用）。Job処理なし。起動・停止のみ。Vitest unit smoke test                                                           |
| packages/api-contracts | Zod。共通`ApiErrorResponse`のみ。業務DTOなし                                                                                                   |
| packages/domain        | フレームワーク非依存。`Result`/`Entity`/`DomainError`のみ。業務エンティティなし                                                                |
| packages/ui            | React peer dependency。`AppShell`・`LoadingState`のみ                                                                                          |
| packages/config        | Zodベースの環境変数検証。`NODE_ENV`・`LOG_LEVEL`のみ                                                                                           |
| packages/logger        | Pino。`password`/`token`/`authorization`/`cookie`のredaction                                                                                   |
| packages/test-utils    | `withEnv`のみ（機能固有fixtureなし）                                                                                                           |
| TypeScript             | `strict: true`、`noUncheckedIndexedAccess: true`。`exactOptionalPropertyTypes`は不採用（理由は`OPEN_QUESTIONS_PR01.md`）                       |
| Quality                | ESLint flat config（`no-explicit-any`, `ban-ts-comment`, `no-floating-promises`, `import/order`, React Hooks lint）、Prettier、`.editorconfig` |
| CI                     | `.github/workflows/ci.yml`：install(frozen-lockfile) → format:check → lint → typecheck → test → build                                          |
| Docs                   | `README.md`、`docs/ARCHITECTURE.md`、`OPEN_QUESTIONS_PR01.md`                                                                                  |

## 実行コマンドと結果

すべて本ブランチのコミット `5d19362718af20a4894c84a0267588c67c03b454` に対し、
クリーンな状態（`rm -rf node_modules apps/*/node_modules
packages/*/node_modules apps/*/dist packages/*/dist .turbo
apps/*/.turbo packages/*/.turbo` を実行後）から検証した。

```bash
corepack enable
pnpm install --frozen-lockfile   # 成功
pnpm format:check                # 成功（10/10 workspaces）
pnpm lint                        # 成功（13/13 tasks）
pnpm typecheck                   # 成功（13/13 tasks）
pnpm test                        # 成功（13/13 tasks, 27 tests）
pnpm build                       # 成功（10/10 workspaces）
```

詳細は `TEST_RESULTS_PR01.md` を参照。

## 未実施項目

- Husky / lint-staged（導入可だが今回は見送り。`OPEN_QUESTIONS_PR01.md` 6.）
- `exactOptionalPropertyTypes`（今回不採用。`OPEN_QUESTIONS_PR01.md` 3.）
- PostgreSQL / Prisma / Migration / 業務ドメイン実装（PR-02以降）

## 未確認事項

- Windows環境での実機検証は未実施（Linuxコンテナ環境でのみ検証）。ただし
  すべてのスクリプトはNode.js組み込みAPIまたはクロスプラットフォーム対応
  ツール（`rm -rf`を除く。下記「発生した問題」参照）で構成している。
- クリーン環境（別コンテナ／別マシン）での再現は、本作業環境内での
  `rm -rf node_modules ... && pnpm install --frozen-lockfile` による疑似
  クリーン実行のみで検証。真の別マシン検証は未実施。

## 発生した問題（と対応）

1. **`packages/domain`の`mapResult`が型エラー** → 三項演算子から
   `if`文＋判別可能な共用体の直接narrowingに書き換えて解消。
2. **`vite.config.ts`の`test`プロパティ型エラー**（admin-web/liff-web）→
   `defineConfig`のimport元を`"vite"`から`"vitest/config"`に変更して解消。
3. **`vite`が2バージョン重複解決される問題**（vitest 2.xが`vite@^5`を
   直接依存として持つため、admin-web/liff-webの明示`vite`依存や
   `packages/ui`の`@vitejs/plugin-react`のpeer解決とバージョンが割れて
   型エラーが発生）→ 全workspaceの`vite`を`^5.4.11`に統一し、
   `packages/ui`にも明示的に`vite`をdevDependencyとして追加して単一
   バージョンに解消。
4. **NestJS（`apps/api`）のDIが実行時に機能しない** → `tsx`（esbuild
   ベース）が`emitDecoratorMetadata`によるコンストラクタ引数メタデータを
   正しく出力しないことが原因と判明。`dev`スクリプトを`nodemon` +
   `node --loader ts-node/esm`（実TypeScriptコンパイラ使用）に変更し、
   実際に`pnpm dev`でサーバーを起動して`curl`でDIが機能することを確認。
   単体テストも実DIコンテナを介さない直接インスタンス化に変更。詳細は
   `OPEN_QUESTIONS_PR01.md` 8.。
5. **Testing Libraryの自動クリーンアップ未設定によるテスト間干渉** →
   各Reactアプリ/`packages/ui`の`vitest.setup.ts`に
   `afterEach(() => cleanup())`を追加して解消。
6. **Prettierが`dist/`配下の生成物も検査してしまう** →
   各workspaceの`format`/`format:check`スクリプトに
   `--ignore-path ../../.prettierignore`を追加して解消。

## 次PRへの引継ぎ

- PR-02（Database and Tenant Foundation）着手前に、
  `OPEN_QUESTIONS_PR01.md`の「Blocker：PR-02前」相当の項目
  （`ai_art_member_id`発番規則、`common_user_id`一意範囲、Tenant/LINE
  Channel対応関係、Admin Role正式名称、PostgreSQL Hosting、Development DB
  のDocker方針）を業務責任者と確定すること。
- `packages/domain`・`packages/api-contracts`は雛形のみ。業務エンティティ
  ・DTOはPR-02以降で追加する。
- `apps/api`のController単体テストは現時点でNestの DIコンテナを経由しな
  い直接インスタンス化としている。業務Controllerが依存注入の実行時契約を
  必要とする場合は、SWC（`unplugin-swc`）等の導入を検討すること。

## ロールバック方法

`ROLLBACK_PROCEDURE_PR01.md` を参照。
