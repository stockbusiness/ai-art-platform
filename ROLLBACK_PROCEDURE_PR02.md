# PR-02 ロールバック手順 (Rollback Procedure)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-02-database-tenant-foundation`

## コミットSHA

- Base（`main`、PR-01マージ済み）: `d249280cc45aa8466018180e9a28cded79542191`
- PR-02本体実装: `eef7ed77749e140e07c22aec8946ed0f5a4543d0`
- CI修正（DATABASE_URL／turbo env）: `4a39ef2c68e6d1aea7a379565b34e6a779b2ead6`
- 提出物7文書: 本コミット

## 前提

PR-02は新規リポジトリ内の基盤追加のみを対象としており、既存PHP版
（`team478a/ai-art-school`）・既存PHP DBには一切変更を加えていない。
また、staging／production Supabaseへのmigration適用も行っていない。
したがってロールバック時もこれらへの影響はゼロである。

## Merge前にロールバックする場合

1. Draft PR（#2）をクローズする。
2. 作業ブランチを削除する。
   ```bash
   git push origin --delete feat/pr-02-database-tenant-foundation
   git branch -D feat/pr-02-database-tenant-foundation   # ローカルがある場合
   ```
3. ローカルDocker Volumeを削除する（開発者ごとに任意）。
   ```bash
   docker compose down
   docker volume rm ai-art-platform_ai_art_platform_pgdata
   ```
4. `main`はPR-01の状態のまま変更されていないため、追加の復旧作業は不要。

## Merge後・staging未適用の場合にロールバックする場合

1. `main`にマージされた本PRのマージコミット（Squashの場合は単一コミット）
   に対して`git revert`を実行する。
   ```bash
   git checkout main
   git pull origin main
   git revert -m 1 <マージコミットSHA>   # マージコミットの場合
   # または
   git revert <squashコミットSHA>        # squashされた単一コミットの場合
   git push origin main
   ```
2. `compose.yaml`とそれに紐づくローカルDocker Volumeは、各開発者が
   個別に削除できる（`docker compose down && docker volume rm
ai-art-platform_ai_art_platform_pgdata`）。
3. CI（`.github/workflows/ci.yml`）の`database` job・Quality jobの
   DB関連ステップもPR-02と共にrevertされる。
4. PHP版（`team478a/ai-art-school`）・staging/production Supabaseは
   本PRの対象外であり、revertによる影響は一切ない。

## PR-02のみを部分的にロールバックする場合

CI修正コミット（`4a39ef2`）のみを個別にrevertできる（本体実装
`eef7ed7`に依存されているため、逆順のみ可能）。

```bash
git revert 4a39ef2   # CI修正（DATABASE_URL／turbo env）のみを戻す
```

ただしこれを行うと、Quality CI jobの`db:validate`が再び失敗し、
`test:integration`がTestcontainersへ意図せずフォールバックする不具合が
再発する（`IMPLEMENTATION_HISTORY_PR02.md`参照）。

本体実装（`eef7ed7`）単体のrevertは推奨しない（Migration・Domain・API
すべてに依存関係があり、部分revertはスキーマ不整合を招くため）。PR-02
全体を対象としたrevertを行うこと。

## Migration（Prismaの自動Down Migration非対応について）

Prismaは自動Down Migrationを生成しない。PR-02で導入した唯一の
Migration（`20260727101006_pr02_tenant_foundation`）をDBから取り除く
必要が生じた場合の手動SQL：

```sql
-- 依存関係の逆順で削除
DROP TABLE IF EXISTS "tenant_settings";
DROP TABLE IF EXISTS "tenant_domains";
DROP TABLE IF EXISTS "tenants";
DROP TYPE IF EXISTS "TenantStatus";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260727101006_pr02_tenant_foundation';
```

**このSQLはローカル開発DB・CI用DBにのみ使用すること。** staging/production
へは本PRの時点で一切適用していないため、この手順自体が不要である。
将来staging/productionへ適用した後にロールバックが必要になった場合は、
指示書20章の方針に従い、以下を必須とする：

- Backup確認
- Rollback SQLレビュー
- 影響件数確認
- Migration履歴とSchema整合性確認

## ロールバックを判断する基準

以下のいずれかに該当する場合、PR-02を完了扱い・マージ可能とはしない。

- Migrationを空DBへ適用できない（本PRでは適用成功・2回目no-opを確認済み）
- Migrationが環境により異なる結果になる
- Seedが重複する（本PRでは冪等性を確認済み）
- Windows CIが失敗する
- Database CIが失敗する
- ControllerからPrismaを直接呼んでいる（本PRでは全てUseCase経由、
  `DATABASE_BOUNDARIES.md`で構造的に文書化）
- DomainがPrisma／NestJSへ依存する（`domain-purity.test.ts`で検証）
- DB URLがBrowser bundleへ含まれる
- DB URL／Secretがログへ出る（`packages/logger`のredaction対象に追加済み）
- Tenant Key重複を許す（本PRでは repository/integration testで検証済み）
- Primary Domain重複を許す（本PRでは repository/integration testで検証済み）
- 無認証のTenant作成・更新APIが公開されている（本PRでは非公開）
- PR-03以降の機能が混入する（本PRでは混入なしを確認済み）
- staging／productionへ無断Migrationする（本PRでは一切実施していない）
- 既存PHP DBへ影響する（本PRでは接続すらしていない）

## 影響範囲の確認

- 本PRの変更はすべて新規リポジトリ`stockbusiness/ai-art-platform`内、
  かつローカル開発用Docker Postgres／CI用の一時的なPostgresサービス
  コンテナに閉じている。staging Supabase・production・既存PHP DBへの
  接続・書き込みは一切行っていない。
- `.env.example`のDB認証情報はローカル開発専用の非秘密値
  （`aiart`/`aiart_local`）であり、実際の秘密情報はコミットしていない。
  ロールバック時にSecret Rotationは不要。
