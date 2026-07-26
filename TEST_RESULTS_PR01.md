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
