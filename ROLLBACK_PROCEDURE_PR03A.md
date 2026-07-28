# PR-03A ロールバック手順 (Rollback Procedure)

## 対象リポジトリ

`stockbusiness/ai-art-platform`

## 作業ブランチ

`feat/pr-03a-admin-auth-rbac`

## コミットSHA

- Base（`main`、PR-02マージ済み）: `ff0578b1126a51ef688b227212bd1b7db526ae53`
- PR-03A本体実装: `7c7e19b`
- 提出物11文書〜PR #3作成: `3280eaf`〜`6cbfdaa`
- 追加レビュー修正（本ラウンド）: 完了報告の「最新Commit SHA」参照

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

Prismaは自動Down Migrationを生成しない。review-fixラウンドで追加した
Migration（`20260728090611_pr03a_review_fix_hardening`）のみを取り除く
場合の手動SQL（テーブル自体はそのまま、追加したCHECK制約・Indexのみ
削除）：

```sql
ALTER TABLE "admin_login_events" DROP CONSTRAINT IF EXISTS "admin_login_events_success_failure_reason_check";
ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "admin_sessions_token_hash_format_check";
ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "admin_sessions_csrf_token_hash_format_check";
ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "admin_sessions_ip_hash_format_check";
ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "admin_sessions_user_agent_hash_format_check";
ALTER TABLE "admin_login_events" DROP CONSTRAINT IF EXISTS "admin_login_events_email_hash_format_check";
ALTER TABLE "admin_login_events" DROP CONSTRAINT IF EXISTS "admin_login_events_ip_hash_format_check";
ALTER TABLE "admin_login_events" DROP CONSTRAINT IF EXISTS "admin_login_events_user_agent_hash_format_check";
DROP INDEX IF EXISTS "admin_login_events_created_at_idx";
DROP INDEX IF EXISTS "admin_login_events_admin_user_id_created_at_idx";
DROP INDEX IF EXISTS "admin_login_events_email_hash_created_at_idx";
DROP INDEX IF EXISTS "admin_login_events_ip_hash_success_created_at_idx";
DROP INDEX IF EXISTS "admin_sessions_admin_user_id_idx";
DROP INDEX IF EXISTS "admin_sessions_expires_at_idx";
DROP INDEX IF EXISTS "admin_sessions_revoked_at_idx";
DROP INDEX IF EXISTS "admin_users_tenant_id_idx";
DROP INDEX IF EXISTS "admin_users_status_idx";
DROP INDEX IF EXISTS "admin_users_locked_until_idx";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260728090611_pr03a_review_fix_hardening';
```

PR-03A全体（初回実装Migration含む）を取り除く必要が生じた場合の
手動SQL（review-fixのMigrationはテーブル自体を追加していないため、
上記を先に、または合わせて実行してから以下を実行する）：

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
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260728090611_pr03a_review_fix_hardening';
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

review-fixラウンドで追加された基準（`AI_ART_PLATFORM_PR03A_REVIEW_FIX_
INSTRUCTIONS.md`第9章）：

- 並行失敗でCountが欠落する（本PRではAtomic UPDATE + Advisory Lockで
  対応、並行Integration Testで確認済み）
- Rate Limitを並行要求で回避可能（本PRでは`pg_advisory_xact_lock`で
  対応、並行Integration Testで確認済み）
- Proxy Headerを任意偽装可能（本PRでは`ADMIN_TRUST_PROXY_HOPS`既定0で
  信頼せず、統合テストで確認済み）
- CSRFが通常比較のまま（本PRでは`timingSafeStringEqual`へ置換済み）
- DB障害が401（本PRでは503 `AUTH_SERVICE_UNAVAILABLE`へ変更済み、
  DB停止統合テストで確認済み）
- Request ID不一致（本PRではHTTPレスポンスとDB行のrequestIdが一致
  することを統合テストで確認済み）
- Transaction途中失敗でSession等が残る（本PRではFault Injection
  テストでRollbackを確認済み）
- Login Event不整合をDBが許可する（本PRではCHECK制約をRaw SQLで
  検証済み）
- Secret／Password／Token／Emailが不要にログ出力される（本PRでは
  Bootstrap CLIのEmail非表示化を実CLIプロセスの標準出力/エラー出力
  レベルで確認済み）

## 影響範囲の確認

- 本PRの変更はすべて新規リポジトリ`stockbusiness/ai-art-platform`内、
  かつローカル開発用Postgres／CI用の一時的なPostgresサービス
  コンテナに閉じている。staging Supabase・production・既存PHP DBへの
  接続・書き込みは一切行っていない。
- `.env.example`の`AUTH_IP_HASH_SECRET`はローカル開発専用のプレース
  ホルダ値であり、実際の秘密情報はコミットしていない。ロールバック時に
  Secret Rotationは不要（実運用で使われたことがないため）。
