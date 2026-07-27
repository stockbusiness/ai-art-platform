# PR-02 API一覧 (API List)

`apps/api`、ベースパスなし（PR-01の`GET /`はそのまま維持）。

## 既存（PR-01、維持）

### `GET /`

開発情報のみ返却。DB接続なし。

```json
{ "name": "@ai-art-platform/api", "version": "0.1.0", "environment": "development" }
```

## 新規（PR-02）

### `GET /health`

- DBへ一切接続しない。プロセスが応答できることのみを確認。
- 200固定。

```json
{ "status": "ok" }
```

### `GET /ready`

- PostgreSQL接続・Prisma Client利用可能性・`_prisma_migrations`の存在・
  未完了/ロールバック済みMigrationの不在を確認。
- 秘密情報・接続先Host・SQL・Stack Traceはレスポンスへ含めない。

| 状態     | HTTP | Body                                                                                                                             |
| -------- | ---: | -------------------------------------------------------------------------------------------------------------------------------- |
| 準備完了 |  200 | `{ "status": "ready" }`                                                                                                          |
| 準備未了 |  503 | `{ "statusCode": 503, "message": "Database not ready", ... }`（NestJSの`ServiceUnavailableException`既定形。詳細情報は含まない） |

### `GET /api/v1/public/tenants/:tenantKey`

PR-02で公開する唯一の業務API。認証不要（公開情報のみ）。

正常時（200）：

```json
{
  "data": {
    "tenantKey": "default",
    "name": "AIアート教室",
    "timezone": "Asia/Tokyo",
    "defaultLocale": "ja-JP"
  }
}
```

内部UUID（`id`）は含まない。

異常時：

| 条件                      | HTTP | `error.code`           |
| ------------------------- | ---: | ---------------------- |
| tenantKey形式不正         |  400 | `VALIDATION_ERROR`     |
| Tenantなし                |  404 | `TENANT_NOT_FOUND`     |
| Tenant停止中（SUSPENDED） |  403 | `TENANT_SUSPENDED`     |
| DB利用不可・その他の異常  |  503 | `DATABASE_UNAVAILABLE` |

エラーレスポンス形式（`packages/api-contracts`の`apiErrorResponseSchema`
と同一の envelope）：

```json
{ "error": { "code": "TENANT_NOT_FOUND", "message": "Tenant not found", "requestId": "..." } }
```

## 未公開（実装済みだがHTTP非公開）

以下はUseCase・Repositoryとして実装・テスト済みだが、Controllerからは
呼び出していない（section 13.4: PR-03のAdmin認証・RBAC完成前に無認証の
管理APIを作らないため）。

- `CreateTenantUseCase`
- `UpdateTenantUseCase`（名称変更・ステータス遷移）
- `TenantRepository.addTenantDomain`
- `TenantRepository.upsertTenantSetting`

Unit Test（`apps/api/src/modules/tenant/application/*.test.ts`）と
Integration Test（`apps/api/test/integration/tenant-repository.integration.spec.ts`）
から直接検証している。
