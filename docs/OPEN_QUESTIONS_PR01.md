# PR-01 未決事項 (Open Questions)

対象リポジトリ: `stockbusiness/ai-art-platform`
作業ブランチ: `feat/pr-01-monorepo-foundation`

本書は、PR-01（Repository and Monorepo Foundation）の実装中に発生した、
推測で進めなかった事項・記録が必要な決定事項をまとめる。マスタープラン
(`AI_ART_PLATFORM_REDESIGN_MASTER_PLAN_PR01.md`) 12章の未決事項一覧は
PR-02以降のBlockerであり、PR-01の範囲外のためここでは繰り返さない。

## 1. リポジトリ初期状態とmainブランチの扱い（記録・対応済み）

- 作業開始前確認の時点で `stockbusiness/ai-art-platform` はブランチ0件・
  コミット0件の完全な空リポジトリだった。
- 指示書は「作業前確認: 2. mainの最新状態」を求めていたが、`main` 自体が
  存在しなかった。これは指示書が想定する「リポジトリが空、または初期状態
  であること」（作業前確認 3.）と矛盾するものではなく、単に空リポジトリの
  初期化が必要という意味と判断した。
- 対応：`main` ブランチを空コミット1件（`chore: initialize empty
  repository`）で作成し、そこから `feat/pr-01-monorepo-foundation` を分岐
  した。PR-01の内容（README、設定ファイル等）はすべて作業ブランチ側のみに
  存在し、`main` は空のままとした。
- 業務判断ではなく機械的なブートストラップであるため、実装を止めて確認を
  仰ぐ事項ではないと判断したが、記録として残す。

## 2. 作業ブランチ名の指定について

- セッションのハーネスは既定の作業ブランチとして
  `claude/pr-01-monorepo-foundation-okmia0` を指定していたが、ユーザーの
  今回の依頼本文および添付のマスタープランは明示的に
  `feat/pr-01-monorepo-foundation` を作業ブランチとして指定していた。
- ユーザー本人による明示的な指定を優先し、`feat/pr-01-monorepo-foundation`
  で作業した。

## 3. `exactOptionalPropertyTypes` の採用可否

- マスタープラン 11.4-E は採用可否の確認を求めている。
- 判断：**今回のPR-01では採用しない。**
- 理由：React（JSXのprops型）、NestJSデコレータ、Zodの `.optional()` 型な
  ど、周辺ライブラリの型定義が `exactOptionalPropertyTypes` を前提に統一
  されていないため、PR-01の基盤構築の段階で全面採用すると各所に回避コード
  が増え、基盤PRの目的（後続PRが積み上げやすい単純な土台）に反する。
- 次PRへの引継ぎ：業務ドメイン（Tenant/Userなど）の型を実装し始めるPR-02
  以降で、必要であれば再評価する。採用する場合は全packageで統一すること
  （マスタープランの指示どおり）。

## 4. `ai_art_member_id` 発番規則・DB・認証など

- マスタープラン12章に記載のBlocker（PR-02前提のID発番規則、
  common_user_idの一意範囲、Tenant/LINE Channelの対応関係など）は、PR-01
  では一切実装していない。これらはPR-01の変更禁止範囲そのものであり、本書
  では詳細を繰り返さず、マスタープラン12章を正とする。

## 5. Node / pnpm バージョン

- 実行環境で確認できた値：Node.js `v22.22.2`、pnpm `10.33.0`、Corepack
  `0.34.6`。
- `package.json` の `packageManager` を `pnpm@10.33.0` に固定し、`.nvmrc`
  は `22`（系列固定、パッチバージョンは固定しない）とした。パッチバージョ
  ンまで固定すべきか（`22.22.2`）は運用チームの方針次第であり、固定が必要
  な場合はPR-02以降で変更されたい。

## 6. Husky / lint-staged

- マスタープランは「導入してよいが、CIの代替にしない」としている。
- 判断：PR-01では導入しない（未導入は「対象外機能の先行実装をしない」方針
  と対称的にスコープを絞るための判断であり、CI・lint・typecheck・testは
  すべてPR-01のスクリプトとCIで担保されている）。必要なら後続PRで追加可能。

## 7. worker の実装形態（Node standalone vs NestJS standalone）

- マスタープランは「Node／Nest standaloneの起動雛形」とどちらでも良いとし
  ている。
- 判断：PR-01では plain Node/TypeScript（NestJSを使わない）とした。理由：
  ジョブ処理を一切実装しない段階でNestJSのDIコンテナを導入する具体的な利
  点がなく、依存を最小に保てるため。Phase 5でジョブキュー実装時に、必要な
  らNestJS standalone applicationへ移行するか改めて判断する。
