# PR-01 テスト結果 (Test Results)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 対象PR

PR #1 https://github.com/stockbusiness/ai-art-platform/pull/1

## 作業ブランチ

`feat/pr-01-monorepo-foundation`

## コミットSHA

`02fc4b9cfa6a8ed3d3a5d398fe07cde89235ba72`（提出物更新前の最終実装コミット）

## 環境

- Node.js: `v22.22.2`
- pnpm: `10.33.0`（Corepack `0.34.6`経由）
- ローカル検証OS: Linux（コンテナ環境）
- CI検証OS: `ubuntu-latest`、`windows-latest`（GitHub Actions）

---

## 1. Linux ローカル結果

### 実行手順（クリーン状態から）

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules \
       apps/*/dist packages/*/dist .turbo apps/*/.turbo packages/*/.turbo

corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm clean
pnpm build
```

### 結果サマリ

| コマンド                         | 結果                            | 備考                                                               |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | ✅ 成功                         | lockfileとpackage.jsonの不一致なし                                 |
| `pnpm format:check`              | ✅ 成功（10/10 workspace）      |                                                                    |
| `pnpm lint`                      | ✅ 成功（13/13 task）           | `any`/`@ts-ignore`該当なし                                         |
| `pnpm typecheck`                 | ✅ 成功（13/13 task）           | strict mode                                                        |
| `pnpm test`                      | ✅ 成功（13/13 task、25 tests） | 内訳は下表                                                         |
| `pnpm build`                     | ✅ 成功（10/10 workspace）      | apps 4 + packages 6                                                |
| `pnpm clean`                     | ✅ 成功（10/10 workspace）      | `dist`/`.turbo`削除、ソース維持、2回目実行（対象なし）も失敗しない |
| `pnpm build`（再）               | ✅ 成功                         | クリーン後の再ビルドも成功（Turboキャッシュから復元）              |

### `pnpm test` 内訳（訂正：初回提出時「27件」と誤記していたが正しくは25件）

| Workspace                      | Test Files |  Tests | 結果        |
| ------------------------------ | ---------: | -----: | ----------- |
| @ai-art-platform/config        |          1 |      3 | ✅          |
| @ai-art-platform/logger        |          1 |      1 | ✅          |
| @ai-art-platform/domain        |          3 |      6 | ✅          |
| @ai-art-platform/api-contracts |          1 |      3 | ✅          |
| @ai-art-platform/ui            |          2 |      3 | ✅          |
| @ai-art-platform/test-utils    |          1 |      2 | ✅          |
| @ai-art-platform/api           |          1 |      1 | ✅          |
| @ai-art-platform/worker        |          1 |      1 | ✅          |
| @ai-art-platform/admin-web     |          1 |      2 | ✅          |
| @ai-art-platform/liff-web      |          1 |      3 | ✅          |
| **合計**                       |     **13** | **25** | ✅ 全件成功 |

---

## 2. Windows CI 結果

GitHub Actions `windows-latest`（`.github/workflows/ci.yml`のmatrix）。

### 初回実行（コミット`a7f02fc`）：失敗

| ステップ                               | 結果                                                       |
| -------------------------------------- | ---------------------------------------------------------- |
| Install dependencies (frozen lockfile) | ✅ 成功                                                    |
| Check formatting                       | ❌ **失敗**（全10 workspaceで「Code style issues found」） |

原因：Windows runnerは既定で`core.autocrlf=true`のため、checkout時に
リポジトリ内のLFファイルがCRLFへ変換される。`prettier.config.js`の
`endOfLine: "lf"`設定と矛盾し、ほぼ全ファイルがフォーマット違反として
検出された。

対応：`.gitattributes`に`* text=auto eol=lf`を追加し、OS・ローカルgit設定
によらずLF改行を強制。（コミット`eacdfd3`）

### 再実行（コミット`eacdfd3`、`02fc4b9`）：成功

| ステップ                               | ubuntu-latest | windows-latest |
| -------------------------------------- | ------------- | -------------- |
| Checkout                               | ✅            | ✅             |
| Enable Corepack                        | ✅            | ✅             |
| Set up Node.js                         | ✅            | ✅             |
| Install dependencies (frozen lockfile) | ✅            | ✅             |
| Check formatting                       | ✅            | ✅             |
| Lint                                   | ✅            | ✅             |
| Typecheck                              | ✅            | ✅             |
| Test                                   | ✅            | ✅             |
| Build                                  | ✅            | ✅             |
| Clean build outputs (`pnpm clean`)     | ✅            | ✅             |

Run URL（最終コミット`02fc4b9`）:
https://github.com/stockbusiness/ai-art-platform/actions/runs/30223497843

`continue-on-error`は使用していない。どちらかのOSが失敗すればワークフロー
全体が失敗として報告される構成。

---

## 3. 真のClean Clone再現テスト

### 実行方法

作業ディレクトリとは別の一時ディレクトリへ、GitHub上の最新コミットを
`git clone`して検証（Linux環境）。

```bash
git clone --branch feat/pr-01-monorepo-foundation \
  https://github.com/stockbusiness/ai-art-platform.git \
  /tmp/ai-art-platform-pr01-clean
cd /tmp/ai-art-platform-pr01-clean
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm clean
pnpm build
```

### 記録項目

| 項目                | 値                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------- |
| OS                  | Linux（コンテナ環境）                                                                     |
| Node.js version     | v22.22.2                                                                                  |
| pnpm version        | 10.33.0                                                                                   |
| Cloneしたブランチ   | `feat/pr-01-monorepo-foundation`                                                          |
| Clone時のcommit SHA | `eacdfd35f9694b91769b3ce0de6bb3086be249d5`（1回目）、その後`02fc4b9`相当の内容で2回目実施 |
| 未追跡ファイル      | `node_modules`/`dist`/`.turbo`/`.env`いずれも存在しないことを確認済み                     |

### 結果

全コマンド成功（1.のローカル結果と同一の成功パターンを、Clone直後の
まっさらな状態から再現できることを確認）。lockfileは変更されなかった
（`pnpm install --frozen-lockfile`が成功＝lockfile不整合なし）。

### 未実施

- Windows環境でのClean Clone実機確認（Windows CIでのcheckout成功が代理
  指標）。

---

## 4. ルート `pnpm dev` 同時起動確認

### 発見した問題と修正

初回検証で、ルート`pnpm dev`が以下のエラーで**起動不能**であることを
発見した。

```text
x Invalid task configuration
  x You have 10 persistent tasks but `turbo` is configured for
    concurrency of 10. Set `--concurrency` to at least 11 or configure
    `"concurrency"` in `turbo.json`
```

原因：4 apps + 6 packages = 10 workspace全てが`dev`スクリプトを
persistentタスクとして持つため、Turborepoの既定concurrency（10）では
その依存タスク（`^build`）を実行する余地がなく拒否される。

対応：`turbo.json`に`"concurrency": "20"`を追加（コミット`02fc4b9`）。

### 修正後の確認結果

| アプリ    | 確認内容                                   | 結果                                                       |
| --------- | ------------------------------------------ | ---------------------------------------------------------- |
| admin-web | `curl http://localhost:5173/`              | ✅ 200                                                     |
| liff-web  | `curl http://localhost:5174/`              | ✅ 200                                                     |
| liff-web  | `curl http://localhost:5174/auth/callback` | ✅ 200                                                     |
| liff-web  | `curl http://localhost:5174/maintenance`   | ✅ 200                                                     |
| api       | `curl http://localhost:3000/`              | ✅ 200、DI経由で`AppService`が正しく注入され開発情報を返却 |
| worker    | ログ出力確認（`"msg":"worker started"`）   | ✅ 起動確認、異常終了なし                                  |

### 終了確認

プロセスグループ全体へ単発のSIGINT送信（端末での1回のCtrl+Cと同一挙動）
を実施。

- 子プロセス（vite×2、nodemon、tsx watch、`tsc --watch`×6の計10プロセス
  - 各シェルラッパー）が全て残留なく終了したことを`ps -ef`で確認。
- ポート5173/5174/3000のいずれも解放され、`curl`が接続不可（`Couldn't
connect to server`）になることを確認。
- 未処理例外の大量出力は発生せず、`pnpm dev`プロセスは終了コード130
  （SIGINTによる正常な終了コード）で終了。

---

## 5. ブラウザ表示確認

### 実施方法

`PR01_FIX.md` 9.3の「許容」方式を採用：本セッションの実行環境に事前
インストール済みのPlaywright/Chromium（リポジトリのdevDependencyとしては
追加せず）を用いて、`pnpm dev`実行中の各URLを自動操作で確認し、結果を
本書に記録した。

### 確認対象と結果

| URL                                   | HTTPステータス | 本文表示                          | コンソールエラー | 未捕捉例外 | モバイル幅(375×667)表示 |
| ------------------------------------- | -------------- | --------------------------------- | ---------------- | ---------- | ----------------------- |
| admin-web `/`                         | 200            | ✅（タイトル・説明文・Build情報） | 0件              | 0件        | ✅                      |
| admin-web `/unknown-route`（404相当） | 200            | ✅「Page not found.」、崩れなし   | 0件              | 0件        | ✅                      |
| liff-web `/`                          | 200            | ✅（タイトル・説明文・Build情報） | 0件              | 0件        | ✅                      |
| liff-web `/auth/callback`             | 200            | ✅ プレースホルダ文言             | 0件              | 0件        | ✅                      |
| liff-web `/maintenance`               | 200            | ✅ メンテナンス文言               | 0件              | 0件        | ✅                      |

白画面（本文が空）は5画面とも発生しなかった。スクリーンショットは
セッションの一時ディレクトリに保存し、リポジトリへはコミットしていない
（指示書9.2の「スクリーンショットをリポジトリへ大量にCommitしないこと」
に従った）。

### 未実施

- 実ブラウザ（Chrome/Edge）での目視確認は未実施（Playwrightの
  Chromiumのみ）。
- Playwrightによる自動E2Eテストのリポジトリ組み込みは未実施（今回は
  手動確認+記録の許容方式を採用）。

---

## 6. 混入・健全性チェック（再実施）

```bash
grep -rniE "sk-[a-z0-9]{10,}|api[_-]?key\s*=\s*['\"][a-z0-9]|password\s*=\s*['\"][^'\"]{3,}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.env*" --include="*.yml" .
# → 該当なし
git status --porcelain | grep -i "\.env$"
# → none
grep -rli "php" apps packages --include="*.ts" --include="*.tsx"
# → 該当なし
git add -A -n | grep -iE "node_modules|dist/|\.turbo/|coverage/"
# → 該当なし
```

- `packages/domain`の依存に`react`/`nest`/`prisma`を含む項目なし（確認
  済み）。
- `turbo run build --dry-run=json`の依存グラフに循環なし（確認済み、
  `docs/ARCHITECTURE.md`参照）。
- 既存CRLFファイルの有無を`.gitattributes`追加前に確認（`grep -rlU
$'\r'`で該当なし＝リポジトリは元々全てLFで統一されていた）。

## 未実施のテスト（累積）

- Windows実機（開発者PC）でのローカル動作確認。
- macOS実機での動作確認。
- 真のクリーン環境でのWindows Clean Clone確認（Windows CIでのcheckout
  成功が代理指標）。
- Playwrightによるリポジトリ組み込みE2Eテスト。

---

## 7. ラウンド3：受入条件の再検証結果

対象コミット：`e15fa00f8bb379f29d1f96fc50b762080b83decd`（作業開始時点の
Head SHA、本ラウンドでの追加コミット前）。

### 7.1 メイン作業ディレクトリでの再実行

| コマンド                         | 結果                       |
| --------------------------------- | -------------------------- |
| `pnpm install --frozen-lockfile` | ✅ 成功                    |
| `pnpm format:check`              | ✅ 成功（10/10 workspace） |
| `pnpm lint`                       | ✅ 成功（13/13 task）      |
| `pnpm typecheck`                  | ✅ 成功（13/13 task）      |
| `pnpm test`                       | ✅ 成功（13/13 task、25 tests） |
| `pnpm build`                      | ✅ 成功（10/10 workspace） |
| `pnpm clean` → `pnpm build`（再） | ✅ 成功                    |

### 7.2 真のClean Clone再検証（別ディレクトリへの実clone）

- 作業ディレクトリとは別の一時ディレクトリへ`git clone --branch
  feat/pr-01-monorepo-foundation --single-branch`を実行。
- Clone直後、`node_modules`/`dist`/`.turbo`/`.env`のいずれも存在しない
  ことを確認。
- `corepack enable` → `pnpm install --frozen-lockfile` →
  `format:check` → `lint` → `typecheck` → `test` → `build` → `clean`
  → `build`（再）まで全件成功。
- `pnpm test`内訳もメイン環境と同一（13ファイル・25件、全件成功）で
  あることを確認。

### 7.3 ルート`pnpm dev`同時起動再検証（Clean Clone環境）

| アプリ    | 確認内容                                   | 結果                                                       |
| --------- | ------------------------------------------ | ------------------------------------------------------------ |
| admin-web | `curl http://localhost:5173/`              | ✅ 200                                                       |
| liff-web  | `curl http://localhost:5174/`              | ✅ 200                                                       |
| liff-web  | `curl http://localhost:5174/auth/callback` | ✅ 200                                                       |
| liff-web  | `curl http://localhost:5174/maintenance`   | ✅ 200                                                       |
| api       | `curl http://localhost:3000/`              | ✅ 200、`{"name":"@ai-art-platform/api","version":"0.1.0","environment":"development"}` |
| worker    | ログ出力確認（`"msg":"worker started"`）   | ✅ 起動確認                                                  |

`ps -ef`で10個の永続タスク（vite×2、tsc --watch×6、nodemon経由のapi、
tsx watch経由のworker）すべての起動プロセスを確認。

終了確認：起動時の親プロセスグループ（`setsid`で新規セッション化した
PGID）へ単発SIGINTを送信。以降、`ps -ef`で該当プロセスが一件も残って
いないこと、およびポート3000/5173/5174のいずれも`curl`で接続不可
（release済み）となることを確認した。

### 7.4 ブラウザ表示確認（再実施、問題発見と修正）

Playwright（本セッション事前インストール済み、`/opt/pw-browsers`の
Chromium、リポジトリのdevDependencyには追加せず）で、Clean Clone環境の
`pnpm dev`実行中に5画面×2ビューポート（デスクトップ1280×800、モバイル
375×667）を確認。

**修正前の結果**：admin-web `/`とliff-web `/`について、各アプリへの
初回ナビゲーション時（デスクトップビューポートで最初に検証したケース）
にコンソールエラーが1件検出された。

```text
Failed to load resource: the server responded with a status of 404 (Not Found)
```

原因調査の結果、`apps/{admin-web,liff-web}/index.html`に
`<link rel="icon">`が存在せず、`public/`ディレクトリも存在しないため、
Chromiumがトップレベルナビゲーション時に`/favicon.ico`を自動リクエスト
し、Vite dev serverがその存在しないパスに404を返していたことが判明した
（ネットワークレベルでは`page`の`response`/`requestfailed`イベントに
現れないブラウザ内部リクエストのため特定に追加調査を要した）。同一
オリジンへの2回目以降のnavigationでは再発生しないため、ラウンド2の
確認では見落とされていた可能性が高い。

**対応**：両アプリの`index.html`に`<link rel="icon" href="data:," />`
を追加し、favicon不在をブラウザへ明示してリクエスト自体を抑止した。

**修正後の結果**：

| URL                                   | HTTPステータス | 本文表示 | コンソールエラー | ページエラー |
| -------------------------------------- | -------------- | -------- | ----------------- | ------------ |
| admin-web `/`（desktop/mobile）        | 200            | ✅       | 0件               | 0件          |
| admin-web `/unknown-route`             | 200            | ✅「Page not found.」 | 0件 | 0件          |
| liff-web `/`（desktop/mobile）         | 200            | ✅       | 0件               | 0件          |
| liff-web `/auth/callback`              | 200            | ✅       | 0件               | 0件          |
| liff-web `/maintenance`                | 200            | ✅       | 0件               | 0件          |

修正後の検証スクリプトは`RESULT: PASS`（全10ケース：5画面×2ビューポート
でコンソールエラー0件・ページエラー0件・本文非空）で終了。

### 7.5 混入・健全性チェック（再実施）

```bash
grep -rniE "sk-[a-z0-9]{10,}|api[_-]?key\s*=\s*['\"][a-z0-9]|password\s*=\s*['\"][^'\"]{3,}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.env*" --include="*.yml" --include="*.html" .
# → node_modules配下の型定義コメント（誤検出）以外に該当なし
git status --porcelain | grep -i "\.env$"   # → none
grep -rli "php" apps packages --include="*.ts" --include="*.tsx" --include="*.html"   # → 該当なし
pnpm turbo run build --dry-run=json   # → 正常終了（循環依存エラーなし）
```

`packages/domain/package.json`に`dependencies`キー自体が存在せず、
React/NestJS/Prismaへの依存がないことを確認。

### 7.6 まとめ

| 検証項目                       | 結果                                       |
| ------------------------------ | ------------------------------------------ |
| `clean`のクロスプラットフォーム化 | ✅ 既存実装で充足（`rimraf`、全10 workspace） |
| Windows CI                     | ✅ 既存実装で充足（matrix、直近run成功）    |
| 真のClean Clone                | ✅ 再検証済み、成功                          |
| ルート`pnpm dev`同時起動・終了 | ✅ 再検証済み、成功                          |
| ブラウザ表示確認               | ⚠️ 再検証で新規の軽微な問題（favicon 404によるコンソールエラー）を発見・修正し、再検証でPASSを確認 |
| Secret／PHP／対象外機能混入    | ✅ なし                                      |
