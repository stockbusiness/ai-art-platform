# PR-03A ロールバック手順 (Rollback Procedure)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-03a-admin-auth-rbac`

## コミットSHA

- Base（`main`、PR-02マージ済み）: `ff0578b1126a51ef688b227212bd1b7db526ae53`
- PR-03A本体実装: `7c7e19b`
- 提出物11文書: 本コミット

## 前提

PR-03Aは新規リポジトリ内の基盤追加のみを対象としており、既存PHP版
（`team478a/ai-art-school`）・既存PHP DBには一切変更を加えていない。
また、staging／production Supabaseへのmigration適用も行っていない。
したがってロールバック時もこれらへの影響はゼロである。

## Merge前にロールバックする場合

1. Draft PRをクローズする。
2. 作業ブランチを削除する。
   ```bash
   git push origin --delete feat/pr-03a-admin-auth-rbac
   git branch -D feat/pr-03a-admin-auth-rbac   # ローカルがある場合
   ```
3. ローカルDocker Volumeを削除する（開発者ごとに任意、PR-02の
   `compose.yaml`と共通のためPR-02自体を継続利用する場合は不要）。
4. `main`はPR-02の状態のまま変更されていないため、追加の復旧作業は
   不要。

## Merge後・staging未適用の場合にロールバックする場合

1. `main`にマージされた本PRのマージコミット（Squashの場合は単一
   コミット）に対して`git revert`を実行する。
   ```bash
   git checkout main
   git pull origin main
   git revert -m 1 <マージコミットSHA>   # マージコミットの場合
   # または
   git revert <squashコミットSHA>        # squashされた単一コミットの場合
   git push origin main
   ```
2. CI（`.github/workflows/ci.yml`）のDatabase jobに追加した
   Migration再実行・Bootstrap CLIステップもPR-03Aと共にrevertされる。
3. PHP版（`team478a/ai-art-school`）・staging/production Supabaseは
   本PRの対象外であり、revertによる影響は一切ない。

## PR-03Aのみを部分的にロールバックする場合

本体実装（`7c7e19b`）は単一コミットであり、部分revertは推奨しない
（Migration・Domain・Application・Presentation・CI設定すべてに依存
関係があり、部分revertはスキーマ不整合やビルド不能を招くため）。
PR-03A全体を対象としたrevertを行うこと。

## Migration（Prismaの自動Down Migration非対応について）

Prismaは自動Down Migrationを生成しない。PR-03Aで導入したMigration
（`20260728070941_pr03a_admin_auth_foundation`）をDBから取り除く
必要が生じた場合の手動SQL：

```sql
-- 依存関係の逆順で削除（CHECK制約・部分UNIQUE Indexはテーブルの
-- 一部のため、テーブルごとDROPすれば個別のDROP CONSTRAINTは不要）
DROP TABLE IF EXISTS "admin_login_events";
DROP TABLE IF EXISTS "admin_sessions";
DROP TABLE IF EXISTS "admin_users";
DROP TYPE IF EXISTS "AdminLoginFailureReason";
DROP TYPE IF EXISTS "AdminStatus";
DROP TYPE IF EXISTS "AdminRole";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260728070941_pr03a_admin_auth_foundation';
```

このSQLは`tenants`テーブル自体には触れないため、PR-02のMigration
（`20260727101006_pr02_tenant_foundation`）はそのまま残る
（`admin_users`/`admin_login_events`が`tenants`へ`ON DELETE
RESTRICT`で外部キーを張っていたが、`admin_users`/`admin_login_events`
テーブル自体を先にDROPするため、この制約が障害にならない）。

**このSQLはローカル開発DB・CI用DBにのみ使用すること。** staging/
production へは本PRの時点で一切適用していないため、この手順自体が
不要である。将来staging/productionへ適用した後にロールバックが
必要になった場合は、指示書18章の方針に従い、Claude Code独断で
Table／EnumをDROPしないこと。Backup確認・Rollback SQLレビュー・
影響件数確認・Migration履歴とSchema整合性確認を必須とする。

## ロールバックを判断する基準

以下のいずれかに該当する場合、PR-03Aを完了扱い・マージ可能とはしない
（指示書18章）。

- Passwordが平文保存される（本PRではArgon2id Hashのみ保存を確認済み）
- Session Tokenが平文保存される（本PRではSHA-256 Hashのみ保存を
  確認済み、生Tokenは検証テストで直接確認）
- CSRFなしで状態変更可能（本PRではLogoutにCSRF Guardを適用し、
  Header/Cookie/DB Hashの三者一致を確認済み）
- Tenant越境可能（本PRではSession由来のtenantId以外を信用しない
  設計・統合テストで確認済み）
- `SUPER_ADMIN`とTenant Roleの境界が曖昧（本PRではDB CHECK制約＋
  Domain層の両方で強制、境界検証テスト済み）
- Cookie属性不足（HttpOnly/Secure/SameSite/Max-Age、統合テストで
  確認済み）
- Lockout未実装（本PRでは実装・テスト済み）
- DB CHECK不足（本PRでは6種類のCHECK制約をRaw SQL直接INSERTで
  検証済み）
- Migrationが空DBへ適用できない（本PRでは適用成功・2回目no-opを
  確認済み）
- PR-02適用済みDBへMigrationできない（本PRでは確認済み — PR-02の
  Migrationを一切変更せず新規追加のみで対応）
- CI失敗
- Secret混入（本PRでは自己レビューで該当なしを確認済み）
- ControllerからPrisma直接呼出（本PRでは全てUseCase経由）
- 一般User／LINE等の範囲外機能混入（本PRでは混入なしを確認済み）
- staging／productionへ無断Migrationする（本PRでは一切実施していない）
- 既存PHP DBへ影響する（本PRでは接続すらしていない）

## 影響範囲の確認

- 本PRの変更はすべて新規リポジトリ`stockbusiness/ai-art-platform`内、
  かつローカル開発用Postgres／CI用の一時的なPostgresサービス
  コンテナに閉じている。staging Supabase・production・既存PHP DBへの
  接続・書き込みは一切行っていない。
- `.env.example`の`AUTH_IP_HASH_SECRET`はローカル開発専用のプレース
  ホルダ値であり、実際の秘密情報はコミットしていない。ロールバック時に
  Secret Rotationは不要（実運用で使われたことがないため）。
