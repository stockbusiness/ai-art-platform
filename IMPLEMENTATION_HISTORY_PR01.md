# PR-01 実装履歴 (Implementation History)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-01-monorepo-foundation`（ベースブランチ: `main`）

## コミットSHA

- `d468849` — `chore: initialize empty repository`（`main`、空コミット）
- `5d19362718af20a4894c84a0267588c67c03b454` — `PR-01: pnpm/Turborepo monorepo foundation`（本ブランチ、実装一式）
- `1943d87` — 提出物4文書の初版
- `a7f02fc` — `clean`のクロスプラットフォーム化・Windows CI追加・README Windows手順（`PR01_FIX.md`対応）
- `eacdfd3` — `.gitattributes`追加（Windows CI失敗の修正）
- `02fc4b9` — `turbo.json`に`concurrency`追加（ルート`pnpm dev`失敗の修正）
- （本コミット） — 提出物5文書の更新

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

---

## ラウンド2：`PR01_FIX.md`（PR-01受入条件不足対応）対応

### 受領した指示

添付ZIP `PR01_FIX.zip`（`PR01_FIX.md`/`PR01_FIX.txt`、内容同一）。確認時点
のPR Head SHA `1943d87e7527ec8708cfd1752a78cbd22498da6f` に対する追加修正
指示。既存PR #1へ追加コミットする方針（新規PR作成禁止、`main`直接push
禁止）。

### 実施順序（時系列）

1. PR #1・作業ブランチの最新状態を取得し、`rm -rf`等OS依存スクリプトを
   全workspaceでgrep検索（10箇所ヒット、全て`clean`スクリプト）。
2. ルートへ`rimraf`をdevDependency追加し、全10 workspaceの`clean`スクリ
   プトを`rimraf dist .turbo`へ置換。`pnpm build` → `pnpm clean` →
   （dist/.turbo消滅・ソース維持を確認）→ 存在しないパスへの再実行でも
   失敗しないことを確認。
3. `.github/workflows/ci.yml`を`ubuntu-latest`/`windows-latest`のmatrix化
   （`fail-fast: false`、`continue-on-error`なし）。`pnpm clean`ステップ
   を追加。
4. `README.md`にWindows（PowerShell）向け手順、pnpm固定versionの説明、
   ポート確認方法（Windows/macOS）、`.env.example`のWindows版コピー手順
   を追記。
5. コミット・push（`a7f02fc`）。
6. **Windows CIが失敗**（`<github-webhook-activity>`通知で検知）。ログを
   取得し原因を特定：Windows runnerの`core.autocrlf=true`によりcheckout
   時LF→CRLF変換、Prettierの`endOfLine:"lf"`と衝突し全workspaceの
   `format:check`が失敗。`.gitattributes`（`* text=auto eol=lf`）を追加
   して解消。既存追跡ファイルにCRLF混入がないことを事前に確認
   （`grep -rlU $'\r'`で該当なし）。コミット・push（`eacdfd3`）。
   Windows/Ubuntu両CI成功を確認。
7. 同一コミットに対し、別ディレクトリ（`/tmp/ai-art-platform-pr01-clean`）
   への真のClean Cloneを実施。`node_modules`/`dist`/`.turbo`/`.env`が
   存在しないことを確認した上で、install→format:check→lint→typecheck→
   test→build→clean→build（再）まで成功を確認。
8. ルート`pnpm dev`の同時起動確認を実施したところ、**`Invalid task
configuration`で起動不能**という重大な問題を発見（4 apps + 6
   packagesの計10 workspaceが全て`dev`をpersistentタスクとして持ち、
   Turborepoの既定concurrency=10では`^build`依存タスクを実行する余地が
   ないため拒否される）。`turbo.json`へ`"concurrency": "20"`を追加して
   解消。修正後、4アプリ全てのHTTP到達を確認
   （admin-web/liff-web/`/auth/callback`/`/maintenance`/api）。
9. 終了確認：プロセスグループへの単発SIGINT（端末Ctrl+Cと同一挙動）で
   全子プロセス（vite×2、nodemon、tsx watch、tsc --watch×6）が残留なく
   終了、3ポート（5173/5174/3000）とも解放されることを確認。
10. コミット・push（`02fc4b9`）。
11. Playwright（本環境に事前インストール済みのChromium/Playwright、
    リポジトリの依存としては追加せず）で`pnpm dev`実行中のadmin-web/
    liff-webの5画面（`/`, `/auth/callback`, `/maintenance`, `/`不明ルート
    2種）を確認。コンソールエラー・未捕捉例外ゼロ、白画面なし、
    デスクトップ幅（1280×800）・モバイル幅（375×667）双方で本文表示を
    確認。
12. 既存27→実測25テストの回帰確認（テスト数は初回提出時の記載ミスで、
    実際は13ファイル25件が正しい。今回の文書更新で訂正）、秘密情報・
    PHP・生成物混入チェック、`domain`のframework非依存確認、循環依存
    確認（`turbo run build --dry-run=json`）を再実施し、いずれも問題
    なしを確認。
13. 提出物5文書を更新。
14. 自己レビュー・コミット・push。GitHub Actions成功確認。PR #1へ完了
    報告コメントを追記。

### 今回の追加設計判断

- `clean`はNode.js製CLI（`rimraf`）を用い、シェル固有構文（`rm -rf`）へ
  の依存を排除した。
- 改行コードの一貫性は`.gitattributes`（`eol=lf`強制）で担保し、
  開発者ローカルの`core.autocrlf`設定に依存しないようにした。
- `turbo.json`の`concurrency`は「10 workspace全てにpersistentな`dev`
  タスクがある」という現在の構成を前提に20とした。将来workspaceが増える
  場合は再検証が必要（`OPEN_QUESTIONS_PR01.md`参照）。
- E2Eブラウザ確認は、指示書が明示的に許容する「手動確認＋記録」方式
  （`PR01_FIX.md` 9.3「許容」）を採用し、Playwrightをリポジトリの
  devDependencyとしては追加しなかった。本格導入はPR-06以降の判断とする。

### 変更ファイル（ラウンド2）

```text
package.json（ルート：rimraf追加）
apps/{admin-web,api,liff-web,worker}/package.json（clean変更）
packages/{api-contracts,config,domain,logger,test-utils,ui}/package.json（clean変更）
pnpm-lock.yaml
.github/workflows/ci.yml（Windows matrix化）
.gitattributes（新規）
turbo.json（concurrency追加）
README.md（Windows手順追記）
IMPLEMENTATION_STATUS_PR01.md / IMPLEMENTATION_HISTORY_PR01.md /
TEST_RESULTS_PR01.md / OPEN_QUESTIONS_PR01.md / ROLLBACK_PROCEDURE_PR01.md
（更新）
```
