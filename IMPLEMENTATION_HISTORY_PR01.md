# PR-01 実装履歴 (Implementation History)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-01-monorepo-foundation`（ベースブランチ: `main`）

## コミットSHA

- `d468849` — `chore: initialize empty repository`（`main`、空コミット）
- `5d19362718af20a4894c84a0267588c67c03b454` — `PR-01: pnpm/Turborepo monorepo foundation`（本ブランチ、実装一式）

## 作業前確認の結果

1. リポジトリは `stockbusiness/ai-art-platform` で正しかった。
2. `main` を含め、リポジトリはブランチ0件・コミット0件の完全な空状態
   だった（`main`自体が存在しなかった）。
3. 上記2.は指示書が想定する「空、または初期状態」の範囲内と判断した。
4. 添付指示書内の対象リポジトリ表記は `stockbusiness/ai-art-platform` で
   一致していた。
5. PR-01の変更範囲・変更禁止範囲を11.3/11.5節で確認した。

矛盾点（`main`不在、ハーネス既定ブランチ名とユーザー指定ブランチ名の相違）
は `OPEN_QUESTIONS_PR01.md` の 1./2. に記録した。

## 実装順序（時系列）

1. `main` を空コミットで作成し、リモートへpush。
2. `feat/pr-01-monorepo-foundation` を `main` から分岐。
3. ルート設定ファイル作成：`pnpm-workspace.yaml`、`package.json`、
   `turbo.json`、`tsconfig.base.json`、`eslint.config.js`、
   `prettier.config.js`、`.prettierignore`、`.editorconfig`、
   `.gitignore`、`.nvmrc`、`.env.example`。
4. `packages/config` 実装（Zod環境変数検証）。
5. `packages/logger` 実装（Pino + redaction）。
6. `packages/domain` 実装（`Result`/`Entity`/`DomainError`）。
7. `packages/api-contracts` 実装（`ApiErrorResponse`）。
8. `packages/ui` 実装（`AppShell`/`LoadingState`）。
9. `packages/test-utils` 実装（`withEnv`）。
10. `apps/admin-web` 実装（Vite + React Router雛形）。
11. `apps/liff-web` 実装（Vite + React Router雛形、`/auth/callback`・`/maintenance`）。
12. `apps/api` 実装（NestJS、`GET /`のみ）。
13. `apps/worker` 実装（plain Node standalone）。
14. `.github/workflows/ci.yml` 実装。
15. `README.md`、`docs/ARCHITECTURE.md`、`OPEN_QUESTIONS_PR01.md`（当初 `docs/` 配下→提出物として repo root へ移動）作成。
16. `pnpm install` → 依存解決・ビルドエラーの反復修正（詳細は
    `IMPLEMENTATION_STATUS_PR01.md`「発生した問題」参照）。
17. `pnpm build` / `typecheck` / `test` / `lint` / `format:check` を
    全workspaceで green にした。
18. クリーン環境相当（`node_modules`・`dist`・`.turbo`全削除後）で
    `pnpm install --frozen-lockfile` から再検証。
19. 秘密情報混入チェック、PHPコード混入チェック、循環依存チェック
    （`turbo run build --dry-run=json` の依存グラフ確認）を実施。
20. 実装一式をコミット（`5d19362718af20a4894c84a0267588c67c03b454`）。
21. 提出物4文書（本書含む）を作成しコミット・push。

## 主な設計判断（詳細は `docs/ARCHITECTURE.md` と `OPEN_QUESTIONS_PR01.md`）

- 内部packageは `dist/` にコンパイルしたものをconsumeする方式とし、
  Turboの `dependsOn: ["^build"]` で依存順序を保証した。
- `apps/api`・`apps/worker` のみ `module`/`moduleResolution` を
  `NodeNext` に上書き（Node直接実行のため）。
- `exactOptionalPropertyTypes` は不採用（理由は前述の通り）。
- `apps/worker` はNestJSを使わないplain Node/TypeScriptとした。
- `apps/api` の `dev` は `tsx` ではなく `nodemon` + `ts-node/esm` を採用
  （NestJSのDIに必要な`emitDecoratorMetadata`をesbuildが正しく出力しない
  ため）。

## 変更ファイル

コミット `5d19362718af20a4894c84a0267588c67c03b454` で116ファイルを新規追加
（`git show --stat 5d19362718af20a4894c84a0267588c67c03b454` で全量確認可
能）。主要ディレクトリ：

```text
.github/workflows/ci.yml
apps/{admin-web,liff-web,api,worker}/**
packages/{api-contracts,domain,ui,config,logger,test-utils}/**
docs/{ARCHITECTURE.md,AI_ART_PLATFORM_REDESIGN_MASTER_PLAN_PR01.md}
README.md
pnpm-workspace.yaml / turbo.json / package.json / tsconfig.base.json
eslint.config.js / prettier.config.js / .prettierignore
.editorconfig / .nvmrc / .env.example / .gitignore
pnpm-lock.yaml
```

（`OPEN_QUESTIONS_PR01.md` および本書を含む提出物4文書は後続コミットで
repo rootに追加。）
