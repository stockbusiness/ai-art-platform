# PR-01 ロールバック手順 (Rollback Procedure)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-01-monorepo-foundation`

## コミットSHA

- ベース（`main`）: `d468849`（空コミット、リポジトリ初期化のみ）
- 実装（初版）: `5d19362718af20a4894c84a0267588c67c03b454`
- 提出物4文書（初版）: `1943d87`
- クロスプラットフォーム化・Windows CI追加: `a7f02fc`
- `.gitattributes`追加（Windows CI失敗修正）: `eacdfd3`
- `turbo.json` concurrency追加（`pnpm dev`失敗修正）: `02fc4b9`
- 提出物5文書（更新版）: 本コミット

## 前提

PR-01は新規リポジトリの基盤のみを対象としており、既存PHP版
（`team478a/ai-art-school`）には一切変更を加えていない。したがって
ロールバック時もPHP版への影響はゼロである。

## Merge前にロールバックする場合

1. Draft PRをクローズする。
2. 作業ブランチ `feat/pr-01-monorepo-foundation` を削除する。
   ```bash
   git push origin --delete feat/pr-01-monorepo-foundation
   git branch -D feat/pr-01-monorepo-foundation   # ローカルがある場合
   ```
3. `main` は初期化コミット（`d468849`、空コミット）のみのままなので、
   追加の復旧作業は不要。

## Merge後に重大な問題が判明した場合

### PR-01全体をロールバックする場合

1. `main` にマージされた本PRのマージコミット（またはsquash/rebase時は
   実装コミット）に対して `git revert` を実行する。
   ```bash
   git checkout main
   git pull origin main
   git revert -m 1 <マージコミットSHA>   # マージコミットの場合
   # または
   git revert 5d19362718af20a4894c84a0267588c67c03b454   # squashされた単一コミットの場合
   git push origin main
   ```
2. Revertにより `main` はPR-01適用前（空リポジトリ相当）の状態に戻る。
3. CI（`.github/workflows/ci.yml`）もPR-01と共に取り除かれるため、
   revert後のCI設定は空になる。後続PRで再度CIを導入する場合は、本PRの
   `.github/workflows/ci.yml` を参考にすること。
4. PHP版（`team478a/ai-art-school`）は本PRの対象外であり、revertによる
   影響は一切ない。

### `PR01_FIX.md`対応分（ラウンド2）のみを部分的にロールバックする場合

PR-01本体（`5d19362`）は問題なく、ラウンド2の修正コミット
（`a7f02fc`/`eacdfd3`/`02fc4b9`）にのみ問題がある場合は、これらだけを
個別に`git revert`できる（依存関係がないため、逆順であれば単独revert
可能）。

```bash
git revert 02fc4b9   # turbo.json concurrency
git revert eacdfd3   # .gitattributes
git revert a7f02fc   # clean cross-platform化 + Windows CI + README
```

いずれかをrevertした場合、対応する問題（Windows CI失敗、または
ルート`pnpm dev`起動不能）が再発することに留意し、PRを再度Draftへ戻すか、
`OPEN_QUESTIONS_PR01.md`に理由を記録すること。

## ロールバックを判断する基準（11.9節に基づく）

以下のいずれかに該当する場合はMergeしない、またはMerge後revertする。

- クリーンなclone後に `pnpm install --frozen-lockfile` から
  `pnpm build` までの手順が再現できない。
- `pnpm dev` で4アプリ（admin-web / liff-web / api / worker）のいずれか
  が起動しない。
- CIが不安定（flaky）である。
- package間に循環依存が存在する。
- `packages/domain` がReact/NestJS/Prisma等フレームワークに依存している。
- 秘密情報（APIキー、パスワード等）がコード・ログ・READMEに混入している。
- 既存PHPコードが混入している、またはTypeScriptへ直訳されている。
- PR-02以降の業務機能（DB、認証、LINE、画像生成、予約、決済、利用権、
  ガチャ等）が混入している。
- Node.js/pnpmのバージョンが固定されていない。
- Windows CIが失敗する（本PRではUbuntu/Windows双方のGitHub Actions matrix
  で成功済み。ただし開発者実機Windowsでの動作は未検証、
  `TEST_RESULTS_PR01.md`「未実施のテスト」参照）。
- `pnpm clean`がWindowsで動作しない（`rimraf`ベースのため通常発生しない
  想定だが、`README.md`のTroubleshootingに issue化の案内あり）。
- 真のClean Cloneで再現できない（本PRでは別ディレクトリへの実clone検証
  済み）。
- ルート`pnpm dev`で4アプリ同時起動できない、または1回の終了操作で子
  プロセスが残留する（本PRでは`turbo.json`の`concurrency`修正後に確認
  済み）。
- READMEだけではローカル環境を再現できない。

## 影響範囲の確認

- 本PRの変更はすべて新規リポジトリ `stockbusiness/ai-art-platform` 内に
  閉じている。外部サービス（DB、LINE、Stripe、画像生成API等）への接続、
  外部データの書き込みは一切行っていないため、ロールバックによる外部
  副作用はない。
- 秘密情報・環境変数の実値はコミットしていない（`.env.example`のみ、
  プレースホルダ値なし）ため、ロールバック時にSecret Rotationは不要。
