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

---

## ラウンド3：受入条件の再検証（追加修正指示への対応）

### 受領した指示

ラウンド2（`PR01_FIX.md`）で要求された受入条件（`clean`のクロス
プラットフォーム化、Windows CI、真のClean Clone、ルート`pnpm dev`同時
起動、ブラウザ表示確認）を改めて満たすよう求める指示。既存PR #1・既存
ブランチ`feat/pr-01-monorepo-foundation`への追加コミット限定（新規PR・
新規ブランチ・PR-02着手は禁止）。

### 作業開始前確認（結果）

1. リポジトリ：`stockbusiness/ai-art-platform`（確認済み）
2. ブランチ：`feat/pr-01-monorepo-foundation`（確認済み、`git branch
   --show-current`）
3. リモート最新状態：`git fetch origin feat/pr-01-monorepo-foundation
   main`実行、ローカルHEADとリモートHEADが完全一致（`e15fa00f8bb379f29
   f1f96fc50b762080b83decd`）
4. PR #1の最新Head SHA：`e15fa00f8bb379f29d1f96fc50b762080b83decd`
   （GitHub API `pull_request_read`で確認）
5. 直近CI：Ubuntu／Windows双方`success`（同SHA、Run
   `https://github.com/stockbusiness/ai-art-platform/actions/runs/30223749838`）
6. 未コミット変更：作業開始時点で`git status --porcelain`は空

### 実施内容（時系列）

1. 既存実装（`clean`のrimraf化、Windows CI matrix、`.gitattributes`、
   `turbo.json`の`concurrency`）がラウンド2で既に適用済みであることを
   ファイル内容の直接確認で再検証した（`grep`で`rm -rf`がリポジトリの
   npm scriptsに残っていないこと、`ci.yml`のmatrix設定、
   `.gitattributes`の内容、`turbo.json`の`concurrency: "20"`を個別に
   確認）。コードの再修正は不要と判断した。
2. ローカルで`pnpm install --frozen-lockfile` →
   `format:check`／`lint`／`typecheck`／`test`（25件）→`build`→
   `clean`→`build`（再）の全件成功を再確認。
3. 真のClean Clone再検証：作業ディレクトリとは別の一時ディレクトリへ
   `git clone --branch feat/pr-01-monorepo-foundation
   --single-branch`を実行し、`node_modules`/`dist`/`.turbo`/`.env`が
   存在しないまっさらな状態から、上記と同じコマンド列がすべて成功する
   ことを確認した。
4. ルート`pnpm dev`同時起動再検証：Clean Clone先のディレクトリで
   `setsid pnpm dev`をプロセスグループとして起動し、10個の永続タスク
   （app 4 + package 6）すべての起動を`ps -ef`で確認。admin-web
   （:5173）・liff-web（:5174、`/auth/callback`・`/maintenance`含む）
   ・api（:3000、DI経由のdev情報を返却）・workerの起動ログを`curl`と
   ログ確認で検証。
5. ブラウザ表示確認（Playwright/Chromium、リポジトリ依存には追加せず）
   を再実施したところ、**admin-web `/`とliff-web `/`の初回ロード時に
   限り、コンソールエラーが1件検出された**（デスクトップ幅で発生、
   モバイル幅では2回目以降のnavigationのため未発生というブラウザの
   favicon自動リクエストの挙動差に起因）。詳細は下記「発生した問題」
   参照。
6. 発見した問題を修正後、Clean Clone環境の実行中devサーバーへ同一修正
   を反映し、Playwrightで再検証。5画面×2ビューポート（デスクトップ
   1280×800、モバイル375×667）すべてでコンソールエラー0件・
   ページエラー0件・白画面なしを確認（`RESULT: PASS`）。
7. プロセスグループへの単発SIGINT送信で、10個の子プロセスすべてが
   残留なく終了し、ポート3000/5173/5174がすべて解放されることを再確認。
8. 修正をメインの作業ディレクトリ（`/home/user/ai-art-platform`）にも
   反映し、`format:check`／`lint`／`typecheck`／`test`（25件）／
   `build`を再実行し全件成功を確認。
9. 秘密情報混入チェック（APIキー・パスワード・秘密鍵パターン）、
   `.env`の追跡有無、PHPコード混入チェック、`packages/domain`の
   フレームワーク非依存確認、`turbo run build --dry-run=json`による
   循環依存なしの確認をすべて再実施し、問題なしを確認。
10. 検証用のClean Cloneディレクトリ・Playwrightスクリプトはセッションの
    一時ディレクトリ（scratchpad）にのみ保持し、リポジトリへは
    Commitしていない。
11. 提出文書を更新。

### 発生した問題と解決方法（ラウンド3）

- **admin-web・liff-webにfaviconが未定義**：`index.html`に
  `<link rel="icon">`もアプリの`public/`ディレクトリも存在しなかった
  ため、Chromiumがトップレベルナビゲーション時に`/favicon.ico`を自動
  リクエストし、Vite dev serverが404を返し、`Failed to load resource:
  the server responded with a status of 404 (Not Found)`という
  コンソールエラーが各アプリの初回ロード時にのみ発生していた
  （2回目以降の同一オリジンnavigationでは再発生しないため、ラウンド2
  の確認では見落とされていた可能性がある）。
  対応：両アプリの`index.html`に`<link rel="icon" href="data:," />`を
  追加し、ブラウザにfaviconが存在しないことを明示してリクエスト自体を
  抑止した。バイナリ画像ファイルの追加は不要（データURIのみ）。
  修正後、5画面×2ビューポートで再検証しコンソールエラー0件を確認。

### 今回の変更ファイル

```text
apps/admin-web/index.html（faviconのリンクタグ追加）
apps/liff-web/index.html（faviconのリンクタグ追加）
IMPLEMENTATION_STATUS_PR01.md / IMPLEMENTATION_HISTORY_PR01.md /
TEST_RESULTS_PR01.md / OPEN_QUESTIONS_PR01.md / ROLLBACK_PROCEDURE_PR01.md
（更新）
```

### PRの扱いについて（記録）

今回の指示書は「現在のPRはDraftのまま維持」「条件を満たしてもReady for
Reviewへ変更しない」としていたが、PR #1は本ラウンド開始時点で既に
Draftではなく（`draft: false`）、レビュアー`team478a`による1件の
Approveが付いた状態だった。これは直前の別指示（「最終マージ前の整理と
再レビュー依頼」）に基づき、既に最新Head SHAへの再レビューを依頼済みの
進行中の状態である。指示の矛盾点をユーザーに確認したが応答が得られな
かったため、Draftへの引き戻しは行わず、現状（Ready for Review、再
レビュー待ち）を維持する判断とした。Merge・Ready for Reviewへの変更は
いずれも本ラウンドでは実施していない。
