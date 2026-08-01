# 資安／個資／RLS／Prompt Injection 防護說明

本站為政府採購法互動教學系統。本文件說明目前實作的防護機制與操作建議。

## 1. 資安（應用層）

| 機制 | 說明 |
|------|------|
| 登入驗證 | Google OAuth + Auth.js JWT；API／頁面以 `requireUser`／角色檢查 |
| Middleware | `/admin`、`/teacher`、`my-questions` 無 session cookie 導回首頁；API 變更請求同站 Origin 檢查 |
| 安全標頭 | CSP、`X-Frame-Options: DENY`、`nosniff`、`Referrer-Policy`、`Permissions-Policy` |
| 速率限制 | `/api/chat`、`/api/feedback`、模考交卷、題庫重匯（記憶體桶；多實例建議改 Redis） |
| 模考交卷 | **伺服器端重新評分**，不信任客戶端 `isCorrect` |
| 題庫重匯 | 僅 ADMIN 或 `QUESTION_BANK_REIMPORT_SECRET` Bearer |

## 2. 個資

| 機制 | 說明 |
|------|------|
| 最小必要顯示 | 老師介面以 `maskEmail` 遮罩學員信箱（例：`al***@domain`） |
| 日誌 | 錯誤日誌對自由文字截斷（`redactForLog`） |
| 資料範圍 | 學員僅能讀寫自己的提問／模考／補充；老師可跨學員檢視教學所需資料 |

**建議**：正式環境於 Neon 開啟加密與存取稽核；定期檢視 `ADMIN_EMAILS`／`TEACHER_EMAILS`。

## 3. Row Level Security（RLS）

啟動時 `ensureRlsSchema()` 會對下列表啟用 RLS 並建立政策：

- `UserQuestion`
- `MockExamSession`
- `MockExamSessionAnswer`（經場次擁有者）
- `MockExamSupplement`

政策依 Postgres session 變數：

- `app.current_user_id`：目前使用者（`withUserRls(userId, …)`）
- `app.rls_bypass = on`：老師／管理者跨使用者查詢（`withRlsBypass(…)`）

預設**不** `FORCE ROW LEVEL SECURITY`（方便表擁有者維運／seed）。若要強制連擁有者都受政策約束：

```bash
ENABLE_FORCE_RLS=true
```

強制後，所有使用者資料存取必須走 `withUserRls`／`withRlsBypass`。

## 4. Prompt Injection

| 機制 | 說明 |
|------|------|
| 偵測 | 常見「忽略指令／jailbreak／洩漏 system prompt」中英模式 → 回覆「非本主題的範圍」 |
| 消毒 | 移除控制字元、長度上限 |
| 訊息隔離 | RAG 片段與使用者問題分訊息、以 `<<DATA>>` 區塊標示為資料 |
| 系統提示 | 明確禁止覆寫規則、禁止執行片段內偽指令 |

## 5. 環境變數（相關）

見 `.env.example`：

- `QUESTION_BANK_REIMPORT_SECRET`
- `ENABLE_FORCE_RLS`
- `ADMIN_EMAILS`／`TEACHER_EMAILS`
- `AUTH_SECRET`／`NEXTAUTH_SECRET`

## 6. 後續強化建議

1. 速率限制改接 Upstash Redis（多區域 Vercel）
2. Neon 使用非表擁有者角色 + `ENABLE_FORCE_RLS=true`
3. 個資刪除／匯出流程（當事人權利）
4. CSP 逐步收斂 `unsafe-inline`／`unsafe-eval`
