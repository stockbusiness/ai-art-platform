# AIアート運営プラットフォーム
# React／TypeScript完全再構築 基本設計・MVP・Phase計画・PR-01実装指示書

## 0. 文書情報

| 項目 | 内容 |
|---|---|
| 新規システム | AIアート運営プラットフォーム |
| 新規リポジトリ | `stockbusiness/ai-art-platform` |
| 参照元 | `team478a/ai-art-school` |
| 新規技術 | React / TypeScript / Vite / NestJS / PostgreSQL / Prisma / pnpm / Turborepo |
| アーキテクチャ | モジュラーモノリス / APIファースト / Outbox・Inbox |
| 主実装 | Codex |
| レビュー | Claude Code |
| 作成日 | 2026-07-27 |
| 対象 | React版のみ。PHP版改修は対象外 |

### 0.1 調査根拠

- 既存PHP版 `team478a/ai-art-school` の `main`
- ソース基準コミット：`61cfb4b5da8f797548df80b236a747f4ef066dfc`
- 既存分析書追加コミット：`0456be4129039e7077d95b6db7ab2159ff498fdd`
- 既存ルーター：`index.php`
- 添付資料：`AI_ART_PLATFORM_PHASE0_1_IMPLEMENTATION_INSTRUCTIONS(1).md`

### 0.2 情報区分

本書では、すべての内容を以下の区分で扱う。

| 区分 | 意味 |
|---|---|
| **既存コード確認済み** | PHP版ソースまたは既存分析書で確認できた事実 |
| **新システム仕様** | React版で新たに採用する設計・実装方針 |
| **未決事項** | 業務責任者、他システム、実環境情報を確認して決定する事項 |
| **実環境テスト** | コードだけでは確認できず、LINE、DB、外部API等で検証する事項 |

---

# 1. 既存PHP版から引き継ぐ機能一覧

## 1.1 引継ぎ判定

| 機能領域 | PHP版で確認できた内容 | React版方針 | MVP |
|---|---|---|---:|
| マルチテナント | `tenants`、`tenant_settings`、`tenant_id`、`tenant_key`、テナント切替・停止・診断 | 最初から全テーブルをテナント分離。動的判定は廃止 | 必須 |
| 管理者認証 | メール・パスワード、PHP Session、RBAC、ログイン履歴 | Cookie Session、Argon2id、RBAC、監査ログ | 必須 |
| 管理者管理 | 作成、ロール、テナント、停止、パスワード再設定、削除 | 管理者ライフサイクルとして再実装 | 必須 |
| 一般ユーザー | `users.id`、`line_user_id`、表示名、画像、状態、メモ、会員種別 | UUID内部ID、外部Identity分離、プロフィール管理 | 必須 |
| LINE／LIFF認証 | LINE Webhook署名、ID Token検証、LIFF画面 | ID Token検証成功を必須化。クライアントのLINE IDを信用しない | 必須 |
| LINEメッセージ | Reply、Push、画像送信、個別・教室単位・一斉送信 | Notificationモジュールと配送履歴へ分離 | 個別通知のみ必須 |
| 共通ID | `common_user_id` 照合、Outbox、HMAC、再送 | 共通IDシステムを正本とし投影保存 | 必須 |
| AIアート会員ID | `ai_art_member_id` を発行・保存 | 既存値を不変で移行。新規規則は契約確定後に固定 | 必須 |
| 紹介・代理店 | referral token、紹介者・販売担当・現在担当コード | 正式IDを保存し、履歴を持つ投影モデル | 必須 |
| 教室 | 開催枠作成・編集・中止・削除・詳細・連絡 | Class／ClassSlotモジュールとして再設計 | 必須 |
| 予約 | 予約、承認、取消、一覧、イベント履歴 | Reservationモジュール | 必須 |
| キャンセル待ち | 登録、状態、取消、繰上げ、空き通知 | Waitlistモジュール | 必須 |
| 出席 | 出席一覧、承認、拒否、チェックイン相当、削除 | Attendanceモジュール | 必須 |
| QR | QR設定・表示・削除 | 出席チェックイン方式の一つとして後続実装 | 後続 |
| 画像生成依頼 | LIFF入力、日次上限、依頼保存 | GenerationRequestモジュール | 必須 |
| 画像生成ジョブ | `job_queue`、Worker、手動処理・再実行 | Workerアプリ、DB QueueまたはBullMQ採用をPhase 5で決定 | 必須 |
| 生成画像保存 | `/uploads`、LINE送信、ギャラリー | Object Storage、署名URL、Asset管理 | 必須 |
| 画像生成プロバイダ | OpenAI、Stability AI、xAI候補 | Provider Adapter。特定ベンダーへDomainを依存させない | 1社以上 |
| 利用権 | 回数券、サブスク、画像生成回数、ショッピング権利投影 | Entitlement＋Usage Ledgerへ統一 | 必須 |
| Stripe | Checkout、Webhook、返金、サブスク | 新規正本にしない。移行期間のみ互換対象 | 移行時のみ |
| 千ノ国ショッピング | HMAC Webhook、Inbox、決済・利用権投影、冪等性 | `entitlement.*` を利用権変更の根拠として実装 | 必須 |
| プロフィール | LIFFプロフィール表示・保存 | 最小プロフィールとして再実装 | 必須 |
| アンケート | LIFFアンケート | 汎用Formモジュール候補 | 後続 |
| ガチャ | LIFF、キャンペーン、レアリティ、景品、付与 | AIアート運営基盤から分離。必要時は外部連携 | 非MVP |
| リッチメニュー | 設定、適用、削除、セグメント、同期 | LINE運用モジュールとして後続 | 後続 |
| 一斉配信 | 全体・教室単位等の配信 | 配信同意、レート、履歴を備えて後続 | 後続 |
| レポート・CSV | 統計、ユーザー・出席・依頼CSV | 基本集計のみMVP、詳細分析は後続 | 一部 |
| 監査・ログ | 管理者ログ、予約イベント、システムログ | 構造化監査ログ、Request ID、Correlation ID | 必須 |
| OEMセットアップ | テナント作成、設定、テンプレート、引継ぎ出力 | Tenant Provisioningへ再設計 | 基盤のみ |
| バックアップ | 管理画面から取得・復元 | インフラ運用へ移管 | 非MVP |
| ZIP更新・ロールバック | 管理画面からアップロード・復元 | GitHub Actions＋デプロイ基盤へ移管 | 廃止 |

## 1.2 既存コード確認済みの重要事項

1. PHP版は独自MVC、PDO、MySQL／MariaDB想定である。
2. `index.php` に大量のルートが集中している。
3. Webリクエスト中に `CREATE TABLE`、`ALTER TABLE`、`SHOW COLUMNS` を実行する経路がある。
4. LINE Webhook、LIFF、画像生成、教室予約、出席、Stripe、ショッピング、共通ID、紹介連携が同一システム内に存在する。
5. 共通ID送信はOutbox、ショッピング受信はInboxと冪等性を持つ。
6. PHP版の画像生成LIFFには、ID Token検証失敗後もクライアント入力の `lineUserId` を使用できる重大な認証問題が報告されている。
7. `agency_id`、`closing_agent_id` はPHP版で確認できず、代理店関連はコード中心で保存されている。
8. `config/app.php`、`config/database.php`、実DB、LINE Developers、Stripe、外部API設定は静的解析だけでは確認できていない。

---

# 2. 新システムで廃止する機能

## 2.1 恒久廃止

| 廃止対象 | 理由 | 代替 |
|---|---|---|
| PHPコードのTypeScript直訳・移植 | 既存構造・責務集中・動的DDLを引き継ぐため | 業務仕様とデータのみ再設計 |
| Webリクエスト中のDDL | ロック、権限、障害、再現性の問題 | Prisma Migration |
| 管理画面からのZIP更新 | 変更追跡、署名、ロールバック、権限上の危険 | GitHub PR、CI/CD |
| 管理画面からのDBバックアップ復元 | アプリ権限が過大 | PostgreSQL運用・クラウドバックアップ |
| `/install` による本番初期化 | 誤操作・公開リスク | IaC、Migration、Seed |
| `/cron/run?token=...` のHTTP実行 | URL漏洩、重複実行、可観測性不足 | Worker／Scheduler |
| クライアント入力 `lineUserId` による認証 | なりすまし可能 | サーバー側ID Token検証結果のみ |
| ControllerからDB直接操作 | 責務集中、テスト困難 | UseCase＋Repository |
| 外部APIキーの平文DB保存 | 漏洩リスク | Secret Managerまたは暗号化保存 |
| 公開ディレクトリ `/uploads` へ直接保存 | 認可・削除・期限管理不足 | Object Storage＋Asset管理 |
| 重複ルート・巨大switch router | 保守性・検証性が低い | NestJS ControllerとReact Router |
| ガチャ機能の内包 | 別ドメインであり運営基盤を肥大化 | 千ノ国ガチャとのAPI連携 |

## 2.2 段階廃止

| 対象 | 移行条件 |
|---|---|
| PHP版ローカルStripe決済 | ショッピングWebhookと利用権取消・返金テスト完了後 |
| PHP版LINE／LIFFエンドポイント | 新版で全LIFF・Webhook回帰テスト後 |
| PHP版画像生成Worker | 新Workerの成功率・再送・料金計測を確認後 |
| PHP版テナント設定 | 新テナント設定移行とOEM検証後 |
| PHP版CSV・レポート | 新版で必要帳票が揃った後 |

## 2.3 廃止ではなく後回し

次は業務価値があるため削除確定ではないが、MVP外とする。

- アンケート
- 一斉配信
- リッチメニュー高度運用
- QRチェックイン
- 高度レポート
- ギャラリー公開
- OEMセットアップウィザード
- テナント別引継ぎパッケージ
- 管理者SSO
- ウォレット・ポイント
- 代理店報酬計算

---

# 3. MVP機能

## 3.1 運用MVPの定義

「既存PHP版を全面停止できる最小範囲」ではなく、まず1テナントで実運用を安全に開始できる範囲をMVPとする。

### 必須

1. テナント
2. 管理者認証・RBAC
3. ユーザー・LINE外部Identity
4. `common_user_id`
5. `ai_art_member_id`
6. 代理店・担当者投影
7. LINE／LIFF認証
8. 教室・開催枠
9. 予約・取消・キャンセル待ち
10. 出席
11. 利用権・利用回数
12. 画像生成依頼
13. 非同期Worker
14. 生成画像Asset
15. LINE通知
16. 千ノ国ショッピングWebhook
17. Outbox／Inbox
18. 監査ログ
19. 基本ダッシュボード
20. データ移行Dry Run

### MVP外

- ガチャ
- ウォレット残高
- OVE等ポイント
- 代理店報酬
- 管理者SSO
- 一斉配信
- アンケートビルダー
- 高度CRM
- 高度分析
- 複数画像生成プロバイダの自動最適化
- 顧客自身によるOEMセルフ開設

## 3.2 MVPの連携可否目標

| 対象 | MVP目標判定 |
|---|---:|
| LINE／LIFF | ◎ |
| 教室・予約・出席 | ◎ |
| 画像生成 | ◎ |
| 千ノ国共通ID | ○ |
| 代理店紐づけ | ○ |
| 千ノ国ショッピング | ○ |
| PHPデータ移行 | ○ |
| ウォレット・ポイント | △ |
| 代理店報酬 | △ |

---

# 4. 画面一覧

## 4.1 管理画面 MVP

| URL案 | 画面 | 主な権限 |
|---|---|---|
| `/login` | 管理者ログイン | 公開 |
| `/dashboard` | 稼働状況、件数、失敗イベント | 全管理者 |
| `/tenants` | テナント一覧 | SUPER_ADMIN |
| `/tenants/:id` | テナント詳細 | SUPER_ADMIN / TENANT_OWNER |
| `/admins` | 管理者一覧・作成・停止・ロール | OWNER以上 |
| `/users` | ユーザー検索・一覧 | STAFF以上 |
| `/users/:id` | ID、LINE、共通ID、代理店、利用権、履歴 | STAFF以上 |
| `/classes` | 教室一覧 | STAFF以上 |
| `/classes/:id` | 教室定義 | STAFF以上 |
| `/class-slots` | 開催枠一覧 | STAFF以上 |
| `/class-slots/:id` | 予約・待機・出席・連絡 | STAFF以上 |
| `/reservations` | 予約横断一覧 | STAFF以上 |
| `/attendance` | 出席・チェックイン | STAFF以上 |
| `/entitlements` | 利用権一覧 | ADMIN以上 |
| `/generation-requests` | 生成依頼・状態 | STAFF以上 |
| `/generation-requests/:id` | 入力、ジョブ、Asset、エラー | STAFF以上 |
| `/integrations` | 共通ID・代理店・ショッピング状態 | ADMIN以上 |
| `/integrations/outbox` | 送信失敗・再送 | ADMIN以上 |
| `/integrations/inbox` | Webhook受信・冪等状態 | ADMIN以上 |
| `/audit-logs` | 監査ログ | OWNER以上 |
| `/settings/line` | LINE／LIFF設定 | OWNER以上 |
| `/settings/generation` | 画像生成プロバイダ設定 | OWNER以上 |

## 4.2 LIFF／利用者画面 MVP

| URL案 | 画面 |
|---|---|
| `/` | テナント解決・起動 |
| `/auth/callback` | LIFF認証処理 |
| `/home` | 利用者ホーム |
| `/profile` | プロフィール |
| `/classes` | 開催枠カレンダー |
| `/classes/:slotId` | 開催枠詳細 |
| `/reservations` | 自分の予約 |
| `/reservations/:id` | 予約状態・取消 |
| `/generate` | 画像生成入力 |
| `/generate/requests/:id` | 生成状況・結果 |
| `/entitlements` | 利用権・残回数 |
| `/complete` | 予約・購入・生成完了 |
| `/error` | エラー |
| `/maintenance` | メンテナンス |

## 4.3 後続画面

- 一斉配信
- リッチメニュー
- QR管理
- アンケート
- ギャラリー
- 高度レポート
- OEMセットアップ
- ポイント／ウォレット
- 代理店報酬参照

---

# 5. ユーザーフロー

## 5.1 初回LIFF登録

```text
利用者がLIFFを開く
  ↓
tenant_key / host / LIFF設定からテナント解決
  ↓
LIFF ID TokenをAPIへ送る
  ↓
APIがLINE検証APIで署名・aud・exp・subを検証
  ↓
user_identities(provider=LINE, external_id=sub)を検索
  ↓
未登録なら users と user_identities を同一Transactionで作成
  ↓
ai_art_member_idを発行
  ↓
common_user.resolve をOutbox登録
  ↓
紹介トークンがある場合 referral.confirm をOutbox登録
  ↓
セッション発行
  ↓
ホーム表示
```

### 必須安全条件

- `line_user_id` はID Tokenの `sub` のみを採用する。
- クライアントが送る `lineUserId` は使用しない。
- LINE検証失敗時はUser、Identity、Outboxを作成しない。
- LIFF Channel／Issuerとテナント設定を照合する。

## 5.2 共通ID・代理店解決

```text
User作成
  ↓
Outbox: common_user.resolve
  ↓
WorkerがHMAC署名付き送信
  ↓
common_user_idをusersへ投影
  ↓
紹介トークンが存在
  ↓
Outbox: referral.confirm
  ↓
agency_id / registration_referrer_id / sales_agent_id
closing_agent_id / assigned_agent_id を投影
  ↓
assignment historyを追加
```

## 5.3 教室予約

```text
開催枠選択
  ↓
認証・テナント確認
  ↓
利用権／参加条件確認
  ↓
定員・申込期間・重複予約確認
  ↓
空きあり: reservation=PENDINGまたはCONFIRMED
空きなし: waitlist_entry=WAITING
  ↓
Domain Event
  ↓
Outbox／Notification
  ↓
LINE通知
```

## 5.4 出席

```text
管理者またはQRでチェックイン
  ↓
予約・テナント・開催日時を確認
  ↓
attendance_recordを作成
  ↓
必要なら画像生成権を付与
  ↓
Entitlement Ledgerへ記録
  ↓
監査ログ
```

## 5.5 画像生成

```text
利用者が入力
  ↓
認証、利用権、日次制限、教室参加条件を検証
  ↓
generation_request作成
  ↓
利用枠を一時確保
  ↓
generation_jobをQueueへ
  ↓
Provider Adapterで生成
  ↓
Object Storageへ保存
  ↓
generation_asset作成
  ↓
成功: 利用枠を確定消費
失敗: 利用枠を返却
  ↓
LINE通知
```

## 5.6 ショッピング利用権

```text
千ノ国ショッピング
  ↓
HMAC署名Webhook
  ↓
署名・時刻・Key ID・tenant_key検証
  ↓
inbox_eventsへevent_idでINSERT
  ↓
重複なら既処理応答
  ↓
payment.* は決済投影
entitlement.* は利用権正本イベント
  ↓
entitlements / entitlement_ledger更新
  ↓
監査ログ・利用者通知
```

---

# 6. DB設計

## 6.1 ID方針

| ID | 新システム仕様 |
|---|---|
| `users.id` | UUID。内部主キー。外部へ業務IDとして露出しない |
| `common_user_id` | nullable。千ノ国共通ID正本から取得。`(tenant_id, common_user_id)` 一意 |
| `ai_art_member_id` | 外部公開可能な不変ID。既存値を変更しない |
| `line_user_id` | Domain/API上の名称。DBは `user_identities.external_id` にprovider=`LINE`として保存 |
| `agency_id` | 代理店システムの正式ID。AIアート側は投影 |
| `registration_referrer_id` | 登録時紹介者。不変を原則とする |
| `sales_agent_id` | 販売担当 |
| `closing_agent_id` | クロージング担当 |
| `assigned_agent_id` | 現在担当。変更履歴を保持 |

## 6.2 `ai_art_member_id` の未解決差分

### 既存PHP版

```text
aiart:{tenant_key}:{project_key}:{local_user_id}
```

### 添付Phase 0〜1案

```text
aiart:{tenant_key}:{user_uuid}
```

### 採用方針

1. 移行ユーザーの既存IDはそのまま保存する。
2. 外部システムは `ai_art_member_id` を分解せずOpaque Stringとして扱う。
3. 新規ユーザーの発番規則はAPI契約確認後に固定する。
4. 規則変更が必要なら `aiart:v2:{tenant_key}:{uuid}` のように明示的にバージョン化する。
5. PR-01では発番処理を実装しない。
6. PR-02開始前に決定する。

## 6.3 Core／Tenant／Auth

### `tenants`

- `id UUID PK`
- `tenant_key VARCHAR(50) UNIQUE`
- `name`
- `status`
- `timezone`
- `default_locale`
- `created_at`
- `updated_at`

### `tenant_domains`

- `id`
- `tenant_id`
- `host`
- `is_primary`
- UNIQUE `host`

### `tenant_settings`

- `id`
- `tenant_id`
- `key`
- `value_json`
- `is_secret`
- `version`
- UNIQUE `(tenant_id, key)`

秘密情報は暗号化値またはSecret Manager参照のみ。

### `admin_users`

- `id`
- `tenant_id nullable`
- `email`
- `password_hash`
- `name`
- `role`
- `status`
- `last_login_at`
- UNIQUE `(tenant_id, email)`

### `admin_sessions`

- `id`
- `admin_user_id`
- `tenant_id nullable`
- `token_hash`
- `expires_at`
- `revoked_at`
- `ip_hash`
- `user_agent`
- `created_at`

### `admin_login_events`

- 成否、失敗理由、Request ID、IPハッシュ、日時

## 6.4 User／Identity／Agency

### `users`

- `id UUID PK`
- `tenant_id UUID FK`
- `common_user_id VARCHAR nullable`
- `ai_art_member_id VARCHAR NOT NULL`
- `display_name`
- `picture_url`
- `status`
- `member_type`
- `memo`
- `legacy_user_id BIGINT nullable`
- `created_at`
- `updated_at`
- UNIQUE `(tenant_id, common_user_id)` WHERE NOT NULL
- UNIQUE `(tenant_id, ai_art_member_id)`

### `user_identities`

- `id`
- `tenant_id`
- `user_id`
- `provider`
- `issuer`
- `external_id`
- `verified_at`
- `profile_json`
- `legacy_source`
- UNIQUE `(tenant_id, provider, issuer, external_id)`

LINEの場合、`external_id = line_user_id`。

### `user_agency_assignments`

- `id`
- `tenant_id`
- `user_id UNIQUE`
- `agency_id`
- `registration_referrer_id`
- `sales_agent_id`
- `closing_agent_id`
- `assigned_agent_id`
- `assignment_source`
- `source_version`
- `confirmed_at`
- `updated_at`

### `user_agency_assignment_history`

- 変更前後のID
- 原因イベントID
- effective_from / effective_to
- source
- created_at

### `referral_attempts`

- `id`
- `tenant_id`
- `user_id`
- `referral_token_hash`
- `status`
- `external_event_id`
- `last_error`
- `confirmed_at`
- 生トークンは永続化しない

## 6.5 教室・予約・出席

### `classes`

教室の種類・説明・標準時間・公開状態。

### `class_slots`

- 開催日時
- 申込期間
- 定員
- waitlist上限
- 会場／オンラインURL
- status
- version

### `reservations`

- `id`
- `tenant_id`
- `class_slot_id`
- `user_id`
- `status`
- `payment_status`
- `reserved_at`
- `cancelled_at`
- UNIQUE `(tenant_id, class_slot_id, user_id)` for active states

### `waitlist_entries`

- 順番、状態、繰上げ期限、通知日時

### `attendance_records`

- 予約ID
- user_id
- checked_in_at
- method
- status
- handled_by_admin_id

### `reservation_events`

予約・取消・承認・拒否・支払・返金・待機繰上げの追記型履歴。

## 6.6 利用権

### `entitlements`

- 外部または内部利用権ID
- user_id / common_user_id
- type
- product_code
- quantity
- remaining_quantity
- status
- valid_from / valid_until
- source
- source_event_id
- UNIQUE `(tenant_id, source, external_entitlement_id)`

### `entitlement_ledger`

付与、消費、仮確保、確定、返却、取消、期限切れを追記型で保存。

Mutableな残数だけを正本にせず、Ledgerから検証可能にする。

## 6.7 画像生成

### `generation_requests`

- user_id
- tenant_id
- prompt_input
- normalized_prompt
- provider
- model
- status
- request_id
- entitlement_reservation_id
- error_code
- created_at / completed_at

### `generation_jobs`

- generation_request_id
- status
- attempts
- available_at
- locked_at
- worker_id
- last_error

### `generation_assets`

- generation_request_id
- storage_provider
- object_key
- mime_type
- width / height
- checksum
- visibility
- expires_at
- deleted_at

### `generation_usage_daily`

集計高速化用。正本はEntitlement LedgerおよびGeneration Request。

## 6.8 外部連携

### `outbox_events`

- event_id UUID
- tenant_id
- event_type
- aggregate_type
- aggregate_id
- payload_json
- status
- attempts
- available_at
- last_error
- completed_at

### `inbox_events`

- source
- tenant_id
- event_id
- event_type
- payload_json
- payload_hash
- status
- received_at
- processed_at
- UNIQUE `(source, tenant_id, event_id)`

### `integration_deliveries`

送信先、HTTP status、attempt、duration、response summary、Correlation ID。

### `shopping_payment_projections`

決済履歴の参照投影。利用権正本にはしない。

## 6.9 監査・移行

### `audit_logs`

- actor_type / actor_id
- tenant_id
- action
- target_type / target_id
- before_json / after_json
- request_id / correlation_id
- ip_hash
- created_at

秘密情報は禁止。

### `legacy_id_mappings`

- entity_type
- legacy_table
- legacy_id
- new_id
- tenant_id
- source_hash
- migrated_at
- UNIQUE `(legacy_table, legacy_id, tenant_id)`

### `migration_runs`

- run_id
- source_snapshot
- started_at / completed_at
- status
- count_json
- checksum_json

### `migration_errors`

- run_id
- entity
- legacy_id
- error_code
- payload_redacted
- resolution_status

---

# 7. API設計

## 7.1 共通規則

- Base Path：`/api/v1`
- JSON
- OpenAPI
- Zod契約共有
- `X-Request-Id`
- `X-Correlation-Id`
- `Idempotency-Key`
- ページング：cursor優先
- 日時：ISO 8601 UTC
- 表示時：テナントtimezone
- エラーコード固定
- Clientが送る `tenantId` を認証根拠にしない

## 7.2 認証

```text
POST /api/v1/auth/admin/login
POST /api/v1/auth/admin/logout
GET  /api/v1/auth/me

POST /api/v1/auth/line/exchange
POST /api/v1/auth/line/logout
GET  /api/v1/auth/line/me
```

`auth/line/exchange` はID Tokenを検証し、アプリSessionを発行する。

## 7.3 テナント・管理者

```text
GET    /api/v1/admin/tenants
POST   /api/v1/admin/tenants
GET    /api/v1/admin/tenants/:id
PATCH  /api/v1/admin/tenants/:id

GET    /api/v1/admin/admin-users
POST   /api/v1/admin/admin-users
PATCH  /api/v1/admin/admin-users/:id
POST   /api/v1/admin/admin-users/:id/suspend
POST   /api/v1/admin/admin-users/:id/reset-password
```

## 7.4 ユーザー・ID・代理店

```text
GET   /api/v1/admin/users
GET   /api/v1/admin/users/:id
PATCH /api/v1/admin/users/:id

GET   /api/v1/admin/users/:id/identities
GET   /api/v1/admin/users/:id/agency-assignment
GET   /api/v1/admin/users/:id/agency-assignment-history

POST  /api/v1/internal/users/resolve-common-id
POST  /api/v1/internal/users/confirm-referral
```

外部共通ID・代理店APIへの送信はControllerから直接行わず、Outbox経由とする。

## 7.5 教室・開催枠

```text
GET    /api/v1/admin/classes
POST   /api/v1/admin/classes
GET    /api/v1/admin/classes/:id
PATCH  /api/v1/admin/classes/:id

GET    /api/v1/admin/class-slots
POST   /api/v1/admin/class-slots
GET    /api/v1/admin/class-slots/:id
PATCH  /api/v1/admin/class-slots/:id
POST   /api/v1/admin/class-slots/:id/cancel
```

利用者：

```text
GET /api/v1/liff/class-slots
GET /api/v1/liff/class-slots/:id
```

## 7.6 予約・待機・出席

```text
POST /api/v1/liff/reservations
GET  /api/v1/liff/reservations
GET  /api/v1/liff/reservations/:id
POST /api/v1/liff/reservations/:id/cancel

GET  /api/v1/liff/waitlist
POST /api/v1/liff/waitlist/:id/cancel

GET  /api/v1/admin/reservations
POST /api/v1/admin/reservations/:id/approve
POST /api/v1/admin/reservations/:id/reject
POST /api/v1/admin/waitlist/:id/promote

POST /api/v1/admin/attendance/check-in
PATCH /api/v1/admin/attendance/:id
```

## 7.7 利用権・画像生成

```text
GET  /api/v1/liff/entitlements
GET  /api/v1/admin/entitlements

POST /api/v1/liff/generation-requests
GET  /api/v1/liff/generation-requests/:id
GET  /api/v1/admin/generation-requests
GET  /api/v1/admin/generation-requests/:id
POST /api/v1/admin/generation-requests/:id/retry
```

## 7.8 Webhook

```text
POST /api/v1/webhooks/line/:tenantKey
POST /api/v1/webhooks/shopping/:tenantKey
POST /api/v1/webhooks/stripe/:tenantKey   # 移行期間のみ
```

必須：

- Raw Body署名検証
- 時刻許容差
- Key Rotation
- Inboxへの先行記録
- 同一Event再送で200
- Tenant Keyと署名鍵の一致
- Payload Size Limit

## 7.9 運用

```text
GET /health
GET /ready
GET /api/docs
GET /metrics   # 内部公開
```

---

# 8. 外部連携設計

## 8.1 LINE／LIFF

### 新システム仕様

- TenantごとにLINE Channel／LIFF設定を分離する。
- ID Tokenの `iss`、`aud`、`exp`、`sub` を検証する。
- WebhookはLINE署名をRaw Bodyで検証する。
- Messaging API送信は配送テーブルと再送ポリシーを持つ。
- LINE user IDはログへ平文で大量出力しない。
- ブロック、友だち追加解除、プロフィール取得失敗を状態として扱う。

### 実環境テスト

- 各テナントのChannel ID、Secret、LIFF ID
- ID Token audience
- Webhook URL
- Reply Token期限
- Push権限
- リッチメニュー権限
- LINE user IDのチャネル間挙動

## 8.2 千ノ国共通ID

### 新システム仕様

- 正本：共通IDシステム
- AIアート側：投影
- Outbox送信
- HMAC署名
- Idempotency Key
- リトライとDead Letter
- `common_user_id` 取得前でもローカル利用を許可する範囲を機能別に決める

### 未決事項

- 正式API URL
- Key ID／署名ヘッダー
- API version
- 重複統合
- 退会
- common_user_id変更可否
- SLA

## 8.3 代理店

### 新システム仕様

- 正本：代理店システム
- AIアート側：現在値＋履歴投影
- 5項目を別フィールドとして保持する。
  - `agency_id`
  - `registration_referrer_id`
  - `sales_agent_id`
  - `closing_agent_id`
  - `assigned_agent_id`
- 紹介トークン生値は処理完了後に残さない。
- 外部イベントのversionを記録する。

### 未決事項

- 各IDの型
- AgentとAgencyの区別
- 登録紹介者の変更可否
- 販売担当とクロージング担当の責務
- 現在担当の変更権限
- 代理店変更履歴の正本
- 返金・取消時の報酬連動

## 8.4 千ノ国ショッピング

### 新システム仕様

- `payment.*`：決済参照情報
- `entitlement.*`：利用権変更の根拠
- Event ID冪等性
- HMAC・Key ID・Timestamp
- Product Mappingをテナント別に保持
- 返金だけで権利取消を推測せず、`entitlement.revoked` を待つか契約に従う

### 実環境テスト

- 商品コード
- 購入URL
- success/cancel URL
- common_user_id未解決時
- Webhook再送
- 順序逆転
- 返金・取消・期限変更
- 同一購入の二重付与

## 8.5 画像生成

### 新システム仕様

```ts
interface ImageGenerationProvider {
  generate(input: GenerateImageInput): Promise<GenerateImageResult>;
}
```

- DomainはOpenAI、Stability、xAI固有型を参照しない。
- Providerごとにtimeout、retry、rate、costを記録する。
- 同一Requestの再試行で重複課金・重複消費しない。
- NSFW・権利・個人情報ポリシーはTenant設定ではなく共通安全ポリシーを基礎にする。
- 画像はS3互換Object Storageへ保存する。

### 未決事項

- MVPの採用Provider
- モデル
- 料金
- 生成枚数
- 保存期間
- 削除要求
- 生成画像公開範囲

## 8.6 ウォレット・ポイント

MVPでは実装しない。ただし以下のEvent契約を拡張可能にする。

```text
points.granted
points.consumed
points.revoked
wallet.asset.registered
```

---

# 9. データ移行方針

## 9.1 原則

1. PHP本番DBを新アプリから直接更新しない。
2. 移行処理はRead Only接続またはExportファイルを使用する。
3. 全移行を `migration_runs` で追跡する。
4. 既存IDは `legacy_id_mappings` へ保存する。
5. `line_user_id`、`common_user_id`、`ai_art_member_id` を再発行しない。
6. 不正データを自動削除せずQuarantineする。
7. 移行は繰り返し実行可能なUpsert方式とする。
8. 本番切替前に件数・参照・金額・利用権・予約を照合する。

## 9.2 移行対象

### 優先

1. tenants
2. tenant settingsの非秘密設定
3. admin_users
4. users
5. LINE identities
6. common ID mappings
7. referral／agency mappings
8. classes／class_schedules
9. reservations／attendances／waitlists
10. entitlements／tickets／subscriptions
11. image_requests
12. generated assets metadata
13. shopping projections
14. audit・event logsの必要部分

### 原則移行しない

- PHP Session
- 一時Cache
- 失効済みCSRF
- 平文Secret
- cron token
- 過去のWorker lock
- ZIP更新履歴の実ファイル
- 不要なデバッグログ

## 9.3 移行段階

### Step 1：DB Inventory

- 実DBの `SHOW CREATE TABLE`
- Table件数
- NULL率
- 重複
- 文字コード
- timezone
- 外部キー実態
- `tenant_id` 欠損

### Step 2：Mapping固定

`LEGACY_DATA_MAPPING.md` に、旧テーブル・旧カラム・新テーブル・変換規則を記載する。

### Step 3：Dry Run Importer

- 読み取り専用
- Transaction
- Idempotent
- 件数レポート
- Error CSV
- Checksum

### Step 4：初回Bulk

Staging PostgreSQLへ全量投入。

### Step 5：差分同期

`updated_at` が信頼できるテーブルは時刻差分、信頼できない場合はRow Hashで差分を検出する。

### Step 6：並行検証

- PHPは正本
- React版はShadow Read
- 予約数、利用権、画像依頼、共通IDを比較
- 新版から外部通知は送らない

### Step 7：切替

1. PHP側書込停止
2. 最終差分
3. Checksum
4. LINE／LIFF／Webhookを新版へ
5. Smoke Test
6. 監視
7. 切替完了

### Step 8：Rollback

- LINE／LIFF／WebhookをPHPへ戻す
- 新DBへの書込みを停止
- 切替期間中の新規データをExport
- データ差分を記録
- 自動でPHPへ逆書込みしない

## 9.4 移行受入条件

- User件数一致
- LINE Identity重複ゼロ
- common_user_id欠落件数が説明可能
- ai_art_member_id変更ゼロ
- Active予約件数一致
- 待機順位一致
- 利用権残数一致
- 金額集計一致
- Tenant越境ゼロ
- 画像Asset参照切れゼロまたは一覧化
- 再実行して重複ゼロ

---

# 10. Phase別実装計画

## Phase 0：設計固定

成果物：

- SYSTEM_CONTEXT
- MODULE_BOUNDARIES
- ID_POLICY
- SECURITY_POLICY
- ER_DIAGRAM
- API_CONTRACT_POLICY
- LEGACY_DATA_MAPPING
- ACCEPTANCE_TESTS
- OPEN_QUESTIONS

完了条件：

- `ai_art_member_id` 方針確定
- ID正本確定
- Tenant境界確定
- MVP確定
- 廃止機能確定

## Phase 1：基盤

PR分割：

1. PR-01 Repository and Monorepo Foundation
2. PR-02 Database and Tenant Foundation
3. PR-03 Admin Authentication and RBAC
4. PR-04 User and External Identity
5. PR-05 Admin Web Foundation
6. PR-06 Audit, Health, OpenAPI and CI

Phase 1では画像生成・予約・決済・利用権・本番LINE接続を実装しない。

## Phase 2：LINE／共通ID／代理店

- LINE ID Token Verifier
- LINE Webhook
- User作成
- common_user.resolve Outbox
- referral.confirm Outbox
- 代理店5ID投影
- Integration管理画面
- 実接続テスト

## Phase 3：教室・予約・出席

- Classes
- Class Slots
- Reservations
- Waitlist
- Attendance
- 通知
- 基本CSV
- 回帰テスト

## Phase 4：利用権・ショッピング

- Entitlement
- Ledger
- Shopping Inbox
- Payment Projection
- Product Mapping
- 取消・返金・期限
- 冪等性・順序逆転テスト

## Phase 5：画像生成

- Generation Request
- Worker
- Provider Adapter
- Object Storage
- 利用枠仮確保・確定・返却
- LINE結果通知
- コスト・失敗率記録

## Phase 6：データ移行

- 実DB Inventory
- Importer
- Dry Run
- Shadow Read
- Reconciliation Report

## Phase 7：Pilot／Cutover

- 1テナントPilot
- 新規ユーザー限定または指定ユーザー限定
- 本番接続
- 最終差分移行
- 切替
- ロールバック訓練

## Phase 8：OEM・追加機能

- リッチメニュー
- 一斉配信
- アンケート
- 高度分析
- OEM Provisioning
- ウォレット・ポイント
- 代理店報酬参照
- 管理者SSO

---

# 11. Codex向け PR-01 実装指示書

## 11.1 作業目的

新規リポジトリに、以後の全PRが安全に積み上がるpnpm／Turborepoモノレポ基盤を作る。

このPRでは業務機能を実装しない。

## 11.2 対象

```text
Repository: stockbusiness/ai-art-platform
Base branch: main
Work branch: feat/pr-01-monorepo-foundation
PR title: PR-01 Repository and Monorepo Foundation
```

リポジトリが存在しない場合、先に空の非公開リポジトリを作成する。Codexにリポジトリ作成権限がない場合は、作成作業を停止し、不足権限を報告する。既存PHPリポジトリには作成しない。

## 11.3 変更範囲

```text
apps/admin-web/
apps/liff-web/
apps/api/
apps/worker/
packages/api-contracts/
packages/domain/
packages/ui/
packages/config/
packages/logger/
packages/test-utils/
docs/
.github/
pnpm-workspace.yaml
turbo.json
package.json
tsconfig.base.json
eslint.config.js
prettier.config.js
.editorconfig
.nvmrc
.env.example
.gitignore
README.md
```

## 11.4 必須実装

### A. Runtime／Package Manager

- Node.js 22系
- `packageManager` にpnpm version固定
- Corepack前提
- pnpm workspace
- lockfileをCommit

### B. Turborepo

Task：

```text
dev
build
lint
typecheck
test
format
format:check
clean
```

各Taskの依存関係とcache対象を定義する。

`dev` はpersistent、cache無効。

### C. Apps

#### `apps/admin-web`

- React
- TypeScript
- Vite
- 起動画面にアプリ名とBuild情報
- Router雛形
- Vitest smoke test

#### `apps/liff-web`

- React
- TypeScript
- Vite
- `/`、`/auth/callback`、`/maintenance` のRouter雛形
- LINE SDK本接続はしない
- Vitest smoke test

#### `apps/api`

- NestJS
- `/` は開発情報だけを返してよい
- 業務Controllerを作らない
- DB接続しない
- Unit smoke test

#### `apps/worker`

- Node／Nest standaloneの起動雛形
- Job処理を実装しない
- 起動時に秘密情報を出力しない
- Unit smoke test

### D. Packages

#### `api-contracts`

- Zod導入
- 共通 `ApiErrorResponse` の雛形のみ
- 業務DTOはまだ作らない

#### `domain`

- 外部frameworkへ依存しない
- 空packageではなくREADMEとテスト可能な雛形
- Prisma／Nest／Reactを依存に入れない

#### `ui`

- React peer dependency
- 単純な `AppShell` または `LoadingState` 1つのみ
- Design System構築は対象外

#### `config`

- 環境変数読込の共通方針
- Zod schemaの基盤
- PR-01で必須なのは `NODE_ENV`、`LOG_LEVEL` 程度
- DB、LINE、Stripeの実値を要求しない

#### `logger`

- Pino
- Secret redaction基盤
- password、token、authorization、cookieをredact

#### `test-utils`

- 共通Test setup
- Feature固有fixtureは作らない

### E. TypeScript

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true` は採用可否を確認し、採用した場合は全package統一
- `any` 禁止
- `@ts-ignore` 禁止
- Project Referenceまたはpackageごとのtsconfig継承を整備

### F. Quality

- ESLint flat config
- Prettier
- Import order
- React Hooks lint
- no-floating-promises相当
- `.editorconfig`
- Husky／lint-stagedは導入してよいが、CIの代替にしない

### G. README

非エンジニアでも次を実行できること。

```bash
corepack enable
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

README記載：

- 前提
- ディレクトリ
- 起動方法
- 各アプリURL
- 環境変数
- よくあるエラー
- PR方針
- PHP版を変更しないこと

### H. 基本CI

Phase 1全体の本格CIはPR-06で拡張するが、PR-01自身を保護する最小CIを作る。

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

PostgreSQL、Prisma、Migration、Playwright、Secret Scanの本実装は後続PR。

## 11.5 変更禁止範囲

- `team478a/ai-art-school` の変更
- PHPコードのコピー
- Prisma schema
- Migration
- Tenantテーブル
- Userテーブル
- Admin認証
- LINE SDK本接続
- LINE Channel設定
- Stripe
- ショッピングWebhook
- 画像生成API
- Queue
- Object Storage
- 予約
- 出席
- 利用権
- ガチャ
- 本番デプロイ
- 本番Secret
- `ai_art_member_id` 発番処理
- 外部APIへの通信

## 11.6 受入条件

1. 新規リポジトリである。
2. PHPコードが混入していない。
3. `pnpm install --frozen-lockfile` が成功する。
4. `pnpm dev` で4アプリが起動できる。
5. admin-webとliff-webがブラウザ表示できる。
6. apiとworkerが起動できる。
7. `pnpm build` 成功。
8. `pnpm lint` 成功。
9. `pnpm typecheck` 成功。
10. `pnpm test` 成功。
11. TypeScript strict。
12. `any`、`@ts-ignore` がない。
13. SecretをCommitしていない。
14. Package間の循環依存がない。
15. `domain` がReact、Nest、Prismaへ依存しない。
16. READMEだけで別環境に再現できる。
17. 最小CIが成功する。
18. Phase 1外の機能が入っていない。

## 11.7 テスト項目

### Local

- Clean cloneからinstall
- Windows／macOSまたはLinuxの少なくとも2環境でパス問題確認
- 全workspace build
- 全workspace typecheck
- 全workspace test
- `pnpm dev` の終了処理
- 環境変数不足時の明確なエラー
- Logger redaction

### CI

- lockfile不一致で失敗
- lint違反で失敗
- 型エラーで失敗
- test失敗で失敗
- build失敗で失敗

## 11.8 Claude Codeレビュー観点

1. Monorepo境界
2. Domainのframework非依存
3. 循環依存
4. TypeScript strict
5. Secret混入
6. ScriptのOS依存
7. Turborepo cache設定
8. React／Nestの不要な依存
9. 後続PRがDBや認証を追加しやすい構造
10. PHP版のコード・設計を無批判に持ち込んでいないこと

## 11.9 ロールバック条件

以下の場合はPRをMergeしない。

- Clean cloneで再現できない
- 4アプリのどれかが起動しない
- CI不安定
- package間循環
- Domainがframework依存
- Secret混入
- PHPコード混入
- PR-02以降の業務機能が混入
- Node／pnpm versionが固定されていない
- Windowsでscriptが動かない
- README不足

ロールバック方法：

- PR未MergeならBranch削除
- Merge後に重大問題が判明した場合はPR-01をRevert
- PHP版への影響はゼロであること

## 11.10 完了時提出物

```text
IMPLEMENTATION_STATUS_PR01.md
IMPLEMENTATION_HISTORY_PR01.md
TEST_RESULTS_PR01.md
OPEN_QUESTIONS_PR01.md
```

必須記載：

- Repository
- Branch
- Commit SHA
- PR番号
- Node／pnpm version
- Workspace一覧
- 実行コマンド
- Test結果
- CI URL
- 変更ファイル
- 未実施事項
- 次PRへの引継ぎ
- Rollback方法

## 11.11 Codexへの最終命令

```text
PR-01では基盤だけを構築してください。
業務機能、DB、認証、LINE、画像生成、予約、決済を先行実装しないでください。
旧PHPコードをコピーまたはTypeScriptへ翻訳しないでください。
完了後は自己レビューを行い、受入条件を満たした証拠を提出してください。
対象外作業が必要に見えても同一PRへ追加せず、OPEN_QUESTIONS_PR01.mdへ記録してください。
```

---

# 12. 未決事項一覧

## Blocker：PR-02前

1. `ai_art_member_id` 新規発番規則
2. `common_user_id` の一意範囲
3. TenantとLINE Channelの1対1／多対1
4. UserをTenantごとに別Rowにするか
5. Admin Roleの正式名称
6. PostgreSQL Hosting
7. Development DBのDocker方針

## Blocker：Phase 2前

1. 共通IDAPI正式契約
2. 代理店5IDの型・意味・正本
3. LINE Channel／LIFF一覧
4. 紹介トークン取得元と有効期限
5. 外部障害時の機能制限
6. 退会・統合・LINEブロック

## Blocker：Phase 4前

1. 商品コード
2. 利用権種別
3. 回数券・月額・年額のルール
4. 返金時の権利取消
5. Stripe段階廃止日

## Blocker：Phase 5前

1. 画像生成Provider
2. 1回の生成枚数
3. 料金・上限
4. 画像保存期間
5. 画像削除・公開
6. モデレーション

## Blocker：Cutover前

1. 実DB完全Schema
2. 本番件数
3. Tenant ID欠損
4. Cookie／Domain
5. LINE切替手順
6. Webhook切替手順
7. PHP書込停止時間
8. Rollback責任者

---

# 13. 実環境テスト一覧

1. LINE ID Token検証
2. LINE Webhook署名
3. Tenant別Channel分離
4. 管理者Cookie属性
5. PostgreSQL Migration
6. Tenant越境
7. 共通IDHMAC
8. 共通ID再送
9. 紹介トークン不正・期限切れ・使用済み
10. 代理店5ID保存
11. ショッピングWebhook署名
12. Webhook重複
13. Event順序逆転
14. Entitlement付与・更新・取消
15. 返金
16. 画像生成Provider
17. Provider timeout
18. 画像重複生成防止
19. 利用枠返却
20. Object Storage署名URL
21. LINE画像送信
22. Migration件数・checksum
23. Shadow Read比較
24. Cutover
25. Rollback訓練

---

# 14. 初期結論

- 新規リポジトリ分離は妥当。
- 旧PHP版のコード移植は行わない。
- 業務仕様とIDは引き継ぐが、既存ID値を変更しない。
- 旧版の機能は広いため、React版は「画像生成」だけでなく、Tenant、Identity、Class、Reservation、Attendance、Entitlement、Generation、Integrationの境界を持つ運営プラットフォームとして設計する。
- PR-01はモノレポ基盤のみに限定する。
- `ai_art_member_id` の規則差分は、PR-02前の最優先決定事項とする。
- 共通ID・代理店・ショッピング・LINEの実接続は、静的解析だけで完了判定しない。
