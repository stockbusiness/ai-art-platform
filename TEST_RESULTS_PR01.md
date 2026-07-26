# PR-01 テスト結果 (Test Results)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-01-monorepo-foundation`

## コミットSHA

`5d19362718af20a4894c84a0267588c67c03b454`

## 環境

- Node.js: `v22.22.2`
- pnpm: `10.33.0`（Corepack `0.34.6`経由）
- OS: Linux（コンテナ環境）

## 実行手順（クリーン状態から）

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
```

## 結果サマリ

| コマンド                         | 結果                            | 備考                                         |
| -------------------------------- | ------------------------------- | -------------------------------------------- |
| `pnpm install --frozen-lockfile` | ✅ 成功                         | lockfileとpackage.jsonの不一致なし           |
| `pnpm format:check`              | ✅ 成功（10/10 workspace）      | Prettier違反なし                             |
| `pnpm lint`                      | ✅ 成功（13/13 task）           | ESLint違反なし。`any`/`@ts-ignore`該当なし   |
| `pnpm typecheck`                 | ✅ 成功（13/13 task）           | 全workspace `tsc --noEmit` 成功。strict mode |
| `pnpm test`                      | ✅ 成功（13/13 task、27 tests） | 内訳は下表                                   |
| `pnpm build`                     | ✅ 成功（10/10 workspace）      | apps 4 + packages 6                          |

## `pnpm test` 内訳

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
| **合計**                       |     **13** | **27** | ✅ 全件成功 |

（React Router 未来フラグに関する`stderr`警告が admin-web/liff-web の
テスト実行時に出力されるが、テスト失敗ではない。React Router v7への
移行を見据えた情報提供のみ。対応は後続PRの判断とする。）

## `pnpm dev` 実機起動確認

自動テストではカバーできない「4アプリが実際に起動しブラウザ/curlで到達
できるか」を、各アプリを個別に起動して確認した（受入条件4./5./6.）。

| アプリ    | 起動コマンド                                   | 確認内容                                                                                                                                              | 結果 |
| --------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| admin-web | `pnpm --filter @ai-art-platform/admin-web dev` | `curl http://localhost:5173/` でVite開発用HTMLを取得                                                                                                  | ✅   |
| liff-web  | `pnpm --filter @ai-art-platform/liff-web dev`  | `curl http://localhost:5174/` および `/maintenance` で200                                                                                             | ✅   |
| api       | `pnpm --filter @ai-art-platform/api dev`       | `curl http://localhost:3000/` で `{"name":"@ai-art-platform/api","version":"0.1.0","environment":"development"}` を取得。DIが正しく機能することを確認 | ✅   |
| worker    | `pnpm --filter @ai-art-platform/worker dev`    | 起動ログ（`"msg":"worker started"`）を確認、シグナルで正常停止                                                                                        | ✅   |

## `pnpm build` 成果物確認

- `apps/admin-web/dist/`、`apps/liff-web/dist/`：Vite本番ビルド成功
  （`index.html` + JSバンドル、gzip ~52KB）。
- `apps/api/dist/`、`apps/worker/dist/`：`tsc`によるJS出力成功。
- `packages/*/dist/`：全6packageで `.js`/`.d.ts` 出力成功。

## 依存関係の健全性確認

- `turbo run build --dry-run=json` の依存グラフを確認し、循環依存が
  ないことを確認（`docs/ARCHITECTURE.md`参照）。
- `packages/domain` が `react`/`@nestjs/*`/`prisma` 等を一切
  importしていないことを目視・grepで確認。

## 秘密情報・不要ファイル混入チェック

```bash
grep -rniE "sk-[a-z0-9]{10,}|api[_-]?key\s*=\s*['\"][a-z0-9]|password\s*=\s*['\"][^'\"]{3,}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.env*" .
# → 該当なし
git status --porcelain | grep -i "\.env$"
# → none（.envファイルは追跡されていない）
grep -rli "php" apps packages --include="*.ts" --include="*.tsx"
# → 該当なし
git add -A -n | grep -iE "node_modules|dist/|\.turbo/|coverage/"
# → 該当なし（ビルド成果物はコミット対象外）
```

## 未実施のテスト

- Windows環境での実機テスト（本セッションはLinuxコンテナのみ）。
- 真のクリーンマシン（別コンテナ/別ホスト）での`git clone`からの再現
  （本セッション内での擬似クリーン実行のみ実施）。
- ブラウザでの目視確認（Playwright等によるE2Eは対象外PR。`curl`による
  到達性確認のみ実施）。
