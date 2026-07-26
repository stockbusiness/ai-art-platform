# PR-01 実装状況 (Implementation Status)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 対象PR

PR #1 `PR-01 Repository and Monorepo Foundation`
https://github.com/stockbusiness/ai-art-platform/pull/1

## 作業ブランチ

`feat/pr-01-monorepo-foundation`（ベースブランチ: `main`）

## コミットSHA

| コミット       | 内容                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| `d468849`      | `main` 初期化（空コミット）                                                     |
| `5d19362`      | PR-01本体実装                                                                   |
| `1943d87`      | 提出物4文書の初版                                                               |
| `a7f02fc`      | `clean`スクリプトのクロスプラットフォーム化・Windows CI追加・README Windows手順 |
| `eacdfd3`      | `.gitattributes`追加（Windows CI失敗の修正、詳細は下記）                        |
| `02fc4b9`      | `turbo.json`に`concurrency`追加（ルート`pnpm dev`失敗の修正、詳細は下記）       |
| （本コミット） | 提出物5文書の更新（本ラウンド）                                                 |

## スコープ

`AI_ART_PLATFORM_REDESIGN_MASTER_PLAN_PR01.md` 11章「PR-01 Repository and
Monorepo Foundation」に加え、追加指示書`PR01_FIX.md`（PR-01受入条件不足対応
指示書）の要求事項を実装した。業務機能（テナント、認証、LINE、画像生成、
予約、決済、利用権、ガチャ等）は一切実装していない。

## 実装内容サマリ（PR-01本体）

| 区分                   | 内容                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Runtime                | Node.js 22系（`.nvmrc`）、pnpm 10.33.0（`packageManager`固定）、Corepack前提                                                 |
| Monorepo               | pnpm workspace（`apps/*`, `packages/*`）、Turborepo（`turbo.json`：dev/build/lint/typecheck/test/format/format:check/clean） |
| apps/admin-web         | React + TypeScript + Vite。Router雛形（`/`, `*`）。Build情報表示。Vitest smoke test                                          |
| apps/liff-web          | React + TypeScript + Vite。Router雛形（`/`, `/auth/callback`, `/maintenance`）。LINE SDK本接続なし。Vitest smoke test        |
| apps/api               | NestJS。`GET /` は開発情報のみ返却。DB接続なし。業務Controllerなし。Vitest unit smoke test                                   |
| apps/worker            | Node standalone（NestJS不使用）。Job処理なし。起動・停止のみ。Vitest unit smoke test                                         |
| packages/api-contracts | Zod。共通`ApiErrorResponse`のみ。業務DTOなし                                                                                 |
| packages/domain        | フレームワーク非依存。`Result`/`Entity`/`DomainError`のみ。業務エンティティなし                                              |
| packages/ui            | React peer dependency。`AppShell`・`LoadingState`のみ                                                                        |
| packages/config        | Zodベースの環境変数検証。`NODE_ENV`・`LOG_LEVEL`のみ                                                                         |
| packages/logger        | Pino。`password`/`token`/`authorization`/`cookie`のredaction                                                                 |
| packages/test-utils    | `withEnv`のみ（機能固有fixtureなし）                                                                                         |
| TypeScript             | `strict: true`、`noUncheckedIndexedAccess: true`。`exactOptionalPropertyTypes`は不採用（理由は`OPEN_QUESTIONS_PR01.md`）     |
| Quality                | ESLint flat config、Prettier、`.editorconfig`                                                                                |

## 今回追加した対応（`PR01_FIX.md`対応、クロスプラットフォーム化ラウンド）

| 項目                                             | 対応内容                                                                                                                                                                                                                                                                       | 該当ファイル                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `clean`スクリプトのクロスプラットフォーム化      | 全10 workspaceの`"clean": "rm -rf dist .turbo"`を`rimraf`（Node.js製、OS非依存）ベースへ変更                                                                                                                                                                                   | `package.json`（ルート・全workspace） |
| Windows CI                                       | `.github/workflows/ci.yml`を`ubuntu-latest`／`windows-latest`のmatrix化（`fail-fast: false`）。`continue-on-error`は使用せず、`pnpm clean`もゲートに追加                                                                                                                       | `.github/workflows/ci.yml`            |
| Windows CI失敗の修正（発見・対応）               | 初回のWindows CIで全workspaceの`format:check`が「Code style issues found」で失敗。原因はWindows runnerの`core.autocrlf=true`によりcheckout時にLF→CRLF変換され、PrettierのendOfLine:"lf"設定と衝突したため。`.gitattributes`に`* text=auto eol=lf`を追加して解消                | `.gitattributes`（新規）              |
| ルート`pnpm dev`同時起動バグの修正（発見・対応） | ルート`pnpm dev`が`Invalid task configuration`で起動不能だった。原因は10 workspace全てが`dev`をpersistentタスクとして持ち、Turborepoの既定concurrency（10）ではその依存タスク（`^build`）を実行する余地がなく拒否されるため。`turbo.json`へ`"concurrency": "20"`を追加して解消 | `turbo.json`                          |
| README Windows手順                               | PowerShell向けコマンド、pnpm固定versionの仕組み、ポート使用中確認方法（Windows/macOS双方）、`pnpm clean`のWindows対応済み表明を追記                                                                                                                                            | `README.md`                           |

## 実行コマンドと結果

すべて本ブランチのコミット `02fc4b9`（提出物更新前の最終実装コミット）に
対し、クリーンな状態（`node_modules`/`dist`/`.turbo`全削除後の再インストー
ル、および別ディレクトリへの真のClean Cloneの両方）で検証した。

```bash
corepack enable
pnpm install --frozen-lockfile   # 成功
pnpm format:check                # 成功（10/10 workspaces）
pnpm lint                        # 成功（13/13 tasks）
pnpm typecheck                   # 成功（13/13 tasks）
pnpm test                        # 成功（13/13 tasks, 25 tests）
pnpm build                       # 成功（10/10 workspaces）
pnpm clean                       # 成功（dist/.turboを削除、ソースは維持）
pnpm build                       # 再ビルド成功（Turboキャッシュから復元）
pnpm dev                         # 4アプリ同時起動成功、1回のSIGINTで全終了・ポート解放
```

GitHub Actions（Ubuntu + Windows matrix）も同一コミットで成功済み。詳細は
`TEST_RESULTS_PR01.md`を参照。

## 未実施項目

- Husky / lint-staged（導入可だが今回は見送り。`OPEN_QUESTIONS_PR01.md` 6.）
- `exactOptionalPropertyTypes`（今回不採用。`OPEN_QUESTIONS_PR01.md` 3.）
- Playwrightを開発依存として本リポジトリへ追加するE2E自動化（今回は
  `PR01_FIX.md` 9.2の「許容」方式を採用し、リポジトリ外のPlaywright環境
  から手動でブラウザ確認・記録した。本格的なE2E基盤導入はPR-06以降で判断）
- PostgreSQL / Prisma / Migration / 業務ドメイン実装（PR-02以降）

## 未確認事項

- **実機Windows環境での確認は未実施。** Windows CI（GitHub Actions
  `windows-latest`）上での成功は確認済みだが、開発者の実機PowerShell/
  コマンドプロンプトでの動作確認は行っていない。CIが使用しているツール
  （pnpm, tsc, vite, eslint, prettier, vitest, rimraf, nodemon,
  ts-node/esm, tsx）はいずれもクロスプラットフォーム対応の既知のNode.js
  CLIであり、CI成功はこの点で高い信頼性の代理指標となるが、完全な代替で
  はない。
- **macOS実機での確認は未実施。**（本セッションおよびCIはLinux/Windows
  のみ。macOSはUnix系でLinuxとほぼ同一挙動が期待されるため、リスクは
  Windowsより低いと判断）

## 発生した問題（と対応）

前回ラウンドで発生した問題は`IMPLEMENTATION_HISTORY_PR01.md`を参照。今回
のラウンドで新たに発生・発見した問題は以下（詳細は上表と
`TEST_RESULTS_PR01.md`）。

1. Windows CIの`format:check`全滅（`.gitattributes`追加で解消）
2. ルート`pnpm dev`の起動不能（`turbo.json`の`concurrency`設定で解消。
   ローカルの個別`pnpm --filter <app> dev`検証だけでは検出できなかった
   バグであり、`PR01_FIX.md`が指摘した「ルート`pnpm dev`同時起動確認」の
   実施により初めて判明した）

## 次PRへの引継ぎ

- PR-02（Database and Tenant Foundation）着手前に、
  `OPEN_QUESTIONS_PR01.md`の「Blocker：PR-02前」相当の項目を業務責任者と
  確定すること。
- `packages/domain`・`packages/api-contracts`は雛形のみ。業務エンティティ
  ・DTOはPR-02以降で追加する。
- `apps/api`のController単体テストは現時点でNestのDIコンテナを経由しな
  い直接インスタンス化としている。業務Controllerが依存注入の実行時契約を
  必要とする場合は、SWC（`unplugin-swc`）等の導入を検討すること
  （`OPEN_QUESTIONS_PR01.md` 8.）。
- 本格的なブラウザE2E自動化（Playwright等）はPR-06以降で導入を検討。
- turbo.jsonの`concurrency`はworkspace数が増えると再度不足する可能性が
  ある。新しいpersistentな`dev`タスクを持つworkspaceを追加する際は、
  concurrency値が「persistentタスク数 + 依存build等の同時実行に十分な
  余裕」を満たしているか確認すること。

## ロールバック方法

`ROLLBACK_PROCEDURE_PR01.md` を参照。
