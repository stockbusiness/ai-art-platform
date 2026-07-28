# PR-03A API一覧 (API List)

すべて`apps/api/src/modules/admin-auth/presentation/admin-auth.controller.ts`
で実装。ControllerからPrismaを直接呼ばず、必ずUseCase経由。

## 共通事項（review-fix P0-6/P0-7で追加）

- 全リクエストへ`requestIdMiddleware`（`apps/api/src/infrastructure/http/
request-id.ts`）が1リクエストにつき1個のUUIDを付与し、レスポンス
  Header `X-Request-ID`として返す。エラー時の`error.requestId`は
  必ずこの値と一致し、`admin_login_events.request_id`（Login時）とも
  一致する — クライアント可視の失敗とサーバー側監査ログの相関が
  取れる。
- DB接続不可・Transaction失敗など予期しないInfrastructure障害は、
  従来401(`UNAUTHENTICATED`)へ丸められていたが、`503
AUTH_SERVICE_UNAVAILABLE`へ変更した（内部情報は含まない）。

## POST /api/v1/admin/auth/login

Session不要（新規発行対象）。CSRF検証なし（section 3.4）。

**リクエスト**（Tenant所属管理者）：

```json
{ "tenantKey": "default", "email": "admin@example.com", "password": "..." }
```

**リクエスト**（SUPER_ADMIN）：

```json
{ "email": "root@example.com", "password": "..." }
```

**成功（200）**：

```json
{
  "data": {
    "admin": {
      "id": "uuid",
      "tenantId": "uuid-or-null",
      "tenantKey": "default-or-null",
      "email": "admin@example.com",
      "name": "Admin",
      "role": "TENANT_OWNER"
    }
  }
}
```

副作用：`ai_art_admin_session`（HttpOnly）と`ai_art_admin_csrf`
（非HttpOnly）の2 Cookieを`Set-Cookie`する。`admin_login_events`へ
成功イベントを記録し、`admin_users.failed_login_count`を0へリセット、
`last_login_at`を更新する。

**失敗**：

| HTTP | コード                     | 発生条件（すべて外部からは区別不可能）                                                                                                                              |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTHENTICATION_FAILED`    | 不明tenantKey、Tenant SUSPENDED、不明Email、Password不一致、DISABLED admin、tenantKey欠落時のTenant admin検索、tenantKey存在時のSUPER_ADMIN検索、不正なRequest Body |
| 429  | `TOO_MANY_ATTEMPTS`        | Account Lockout（連続失敗が`ADMIN_LOGIN_ACCOUNT_MAX_FAILURES`到達）、IP単位Rate Limit（`ADMIN_LOGIN_IP_MAX_FAILURES`到達）                                          |
| 503  | `AUTH_SERVICE_UNAVAILABLE` | DB接続不可・Transaction失敗など予期しないInfrastructure障害（review-fix P0-7）                                                                                      |

失敗の実際の理由（`AdminLoginFailureReason`）は`admin_login_events`へ
サーバー側でのみ記録され、レスポンスへは一切含まれない。

**Timing均一化（review-fix P0-2）**：不明Email／Tenant不存在・
SUSPENDED／Admin不存在／DISABLEDの401経路では、実在Adminの
Password Hashが存在しない代わりに固定Dummy Argon2id Hashへの
Verifyを1回実行し、実在AdminのPassword不一致401経路と処理時間を
近づける。Lockout／IP Rate Limitedの429経路はVerify自体を省略する
（元々仕様上、外部応答からもタイミングからも状態を推測させない
ことが目的のため、この2経路は「早期拒否」自体が意図された挙動）。

**並行実行安全性（review-fix P0-3/P0-4）**：Login 1回の処理全体
（IP Rate Limit判定〜結果記録、Account Lockoutカウンタ更新〜結果
記録）は単一DB Transaction内で実行され、同一IPからの並行試行は
`pg_advisory_xact_lock`で直列化される。Account Lockoutカウンタは
Read-Modify-Writeではなく単一UPDATE文で原子的に増分される。

## GET /api/v1/admin/auth/me

- **Guard**：`AdminAuthGuard`, `PermissionGuard`
- **必須Permission**：`admin:self:read`
- **CSRF検証**：不要（GET）

**成功（200）**：

```json
{
  "data": {
    "admin": {
      "id": "uuid",
      "tenantId": "uuid-or-null",
      "tenantKey": "default-or-null",
      "email": "admin@example.com",
      "name": "Admin",
      "role": "TENANT_OWNER"
    }
  }
}
```

Password Hash、Session Token、CSRF Token、IP、User-Agentは一切含まない。
Body/Query/HeaderへTenant IDを含めても無視される — 常にSession由来の
Contextのみが反映される（section 9、統合テストで検証済み）。

**失敗**：

| HTTP | コード                     | 発生条件                                                                             |
| ---- | -------------------------- | ------------------------------------------------------------------------------------ |
| 401  | `UNAUTHENTICATED`          | Cookieなし、Token不正、Sessionなし、期限切れ、Revoked、Adminなし、Admin DISABLED     |
| 403  | `FORBIDDEN`                | Tenant SUSPENDED、Role/tenant_id不整合（構造的異常、通常到達しない）、Permission不足 |
| 503  | `AUTH_SERVICE_UNAVAILABLE` | DB接続不可等のInfrastructure障害（review-fix P0-7、DB停止統合テストで確認済み）      |

## POST /api/v1/admin/auth/logout

- **Guard**：`AdminAuthGuard`, `CsrfGuard`
- **CSRF検証**：必須（`X-CSRF-Token`ヘッダ必須）

**成功**：`204 No Content`。SessionをDBでRevoke（`revoked_at`/
`revoke_reason="USER_LOGOUT"`設定）し、2つのCookieを削除する。

**失敗**：

| HTTP | コード                     | 発生条件                                                                                                                                                                                                                                                       |
| ---- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `UNAUTHENTICATED`          | `AdminAuthGuard`の拒否条件（上記`/me`と同一）。 **同一Cookieでの2回目のLogout要求もここに該当** — 1回目でSessionがRevokeされているため、`AdminAuthGuard`が401で拒否する（安全な冪等的失敗として設計。詳細は`docs/security/SESSION_COOKIE_CSRF_POLICY.md`参照） |
| 403  | `FORBIDDEN`                | CSRF Header欠落、CSRF Cookie欠落、Header/Cookie値不一致、DB保存Hashとの不一致（比較はすべてTiming-safe、review-fix P0-1）                                                                                                                                      |
| 503  | `AUTH_SERVICE_UNAVAILABLE` | DB接続不可等のInfrastructure障害（review-fix P0-7）                                                                                                                                                                                                            |

未知のSession Token（Guardを通過しない不正Cookieでの直接呼び出し）を
渡した場合、`LogoutAdminUseCase`自体は冪等（何もせず成功扱い）に
実装されているが、実際にはこのケースは`AdminAuthGuard`が先に401を
返すため到達しない。

## section 7.4：未実装Endpoint（本PRの対象外）

```text
Password Reset
Password Change
Forgot Password
MFA
Admin Create／Update／Delete
Tenant Create／Update HTTP API
Session一覧
他Session強制Logout
一般User認証
LINE Login
```

## 参考：`GET /api/v1/public/tenants/:tenantKey`（PR-02、変更なし）

PR-03Aでは変更していない。詳細は`API_LIST_PR02.md`参照（本ファイルは
存在すれば併せて参照。存在しない場合は`DATABASE_SCHEMA_PR02.md`／
`IMPLEMENTATION_STATUS_PR02.md`を参照）。
