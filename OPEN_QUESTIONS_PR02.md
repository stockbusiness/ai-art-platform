# PR-02 未決事項 (Open Questions)

対象リポジトリ: `stockbusiness/ai-art-platform`
作業ブランチ: `feat/pr-02-database-tenant-foundation`

本書は、PR-02（Database and Tenant Foundation）の実装中に発生した、
推測で進めなかった事項・記録が必要な決定事項をまとめる。
`AI_ART_PLATFORM_PR02_DATABASE_TENANT_INSTRUCTIONS.md` 1.3節「PR-02でも
未決のまま残す内容」（Supabaseの実プロジェクト情報、LINE実Channel、
共通ID API正式契約、代理店5IDの型、本番データ移行日程、本番Migration
実行責任者）は、本書では推測実装しておらず、指示書の記載どおり未決のまま
とする。

## 1. 指示書第2章の7決定事項（採用済み・記録）

指示書2.1〜2.7の決定はそのまま正式仕様として採用し、以下へ文書化した。
未決事項へは戻していない。

- `docs/architecture/ID_POLICY.md`：2.1（`ai_art_member_id`）、
  2.2（`common_user_id`一意範囲）
- `docs/architecture/TENANT_POLICY.md`：2.3（Tenant↔LINE Channel）、
  2.4（UserはTenantごと別Row）、2.5（Admin Role名）
- `docs/architecture/DATABASE_BOUNDARIES.md`：2.6（PostgreSQL Hosting =
  Supabase、標準PostgreSQL/Prismaのみ依存）
- `compose.yaml`：2.7（Development DB = Docker Compose、PostgreSQL 16
  Alpine）

## 2. Testcontainersパスの本セッション内未検証（記録）

- `pnpm test:integration`は`TEST_DATABASE_URL`未設定時、Testcontainers
  で使い捨てPostgresを自動起動する設計（指示書16.5「Testcontainersを
  優先する」に対応）。
- 本セッションの実行環境ではDocker Hubからのイメージpullがネットワーク
  ポリシーにより拒否されたため、このパス自体の動作確認はできなかった
  （`IMPLEMENTATION_HISTORY_PR02.md`参照）。
- 実際の統合テスト（16件）は`TEST_DATABASE_URL`を実行環境に元々
  インストールされていたネイティブPostgreSQL 16へ向けることで検証した。
  CIの`database` jobはGitHub Actions標準のpostgres serviceコンテナを
  使用しており、Testcontainersには依存しない設計としたため、CI上の
  検証は実施できている。
- 次PRへの引継ぎ：Docker Hubへ到達可能な開発者環境で、`TEST_DATABASE_URL`
  を設定せずに`pnpm test:integration`を実行し、Testcontainersパスが
  実際に機能することを一度確認されたい。

## 3. NestJS DIとVitestのesbuildトランスフォームの非互換（記録・対応済み）

- `OPEN_QUESTIONS_PR01.md`項目8で「業務ControllerがDIの実行時契約を
  必要とする場合はSWC等の導入を検討されたい」と記録していたリスクが、
  PR-02の統合テスト（`@nestjs/testing`によるフルアプリ起動）で実際に
  顕在化した。
- 対応：`unplugin-swc`を`apps/api/vitest.integration.config.ts`にのみ
  導入。Unit Testは対象外（Nestの実DIコンテナを経由しないため無関係）。
- 次PRへの引継ぎ：PR-03でNestJSのDIを経由するテストを追加する
  Controllerが増える場合、同様に統合テスト用vitest設定へ
  `unplugin-swc`を適用すること。

## 4. 管理APIの公開範囲（記録）

- `CreateTenantUseCase`/`UpdateTenantUseCase`は実装・テスト済みだが、
  指示書13.4に従いHTTP公開していない。
- 次PRへの引継ぎ：PR-03でAdmin認証・RBACが完成した後、これらを管理API
  として公開するか、あるいは別の設計（例えばAdmin向け別Controller）に
  するかを判断すること。

## 5. `turbo.json`の`env`宣言運用（記録・対応済み）

- Turborepo 2.xの既定strict env modeにより、`turbo run`経由のtaskへは
  `turbo.json`で明示していない環境変数が渡らないことが、
  `test:integration` taskで判明した。
- 次PRへの引継ぎ：新しいtaskが環境変数（DB接続情報に限らず）に依存する
  場合、`turbo.json`の該当taskへ`env`配列で明示することを忘れないこと。
  暗黙のうちに正しく動いているように見えて、CI環境（シェルの`export`が
  ない環境）で初めて問題が顕在化するため注意。

## 6. Prisma生成物のCI/Lintスコープからの除外（記録・対応済み）

- `packages/database/generated/`はgit追跡対象外（`.gitignore`）だが、
  ローカルの`pnpm format`/`pnpm lint`はこれを検出してしまっていた。
  `.prettierignore`/`eslint.config.js`へ除外を追加して解消した。
- 次PRへの引継ぎ：他のコード生成ツール（OpenAPI Client等）を導入する
  場合も、同様に生成物ディレクトリを両ファイルへ除外登録すること。
