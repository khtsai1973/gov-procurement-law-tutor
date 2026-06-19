# 部署指南（Vercel + Neon PostgreSQL）

本專案使用 **PostgreSQL**（Prisma）。Vercel 無法持久化 SQLite 檔案，請使用 [Neon](https://neon.tech) 或其他託管 Postgres。

## 前置需求

- GitHub（或 Git）儲存庫已推送此專案
- [Vercel](https://vercel.com) 帳號
- [Neon](https://neon.tech) 帳號（免費方案即可）
- Google Cloud OAuth 用戶端（專案 `government-procurement-act2`，見 `GOOGLE-OAUTH.md`）

---

## 一、建立 Neon 資料庫

1. 登入 [Neon Console](https://console.neon.tech)
2. **New Project** → 選區域（建議離使用者較近的區域）
3. 建立後進入專案 → **Connection details**
4. 複製 **Connection string**（Prisma 建議用 **Pooled** 或 **Direct**，皆可；若連線失敗可加上 `?sslmode=require`）

範例（請替換為您自己的值，**勿提交到 Git**）：

```env
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

---

## 二、部署到 Vercel

1. [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**
2. Import 您的 `gov-procurement-law-tutor` 儲存庫
3. Framework Preset 應自動辨識為 **Next.js**（無需額外 `vercel.json`）
4. **Environment Variables**（Production，必要時 Preview 也加一份）：

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | Neon 連線字串（**必須**） |
| `NEXTAUTH_SECRET` | 隨機長字串（`openssl rand -base64 32` 或線上產生器） |
| `NEXTAUTH_URL` | `https://你的專案.vercel.app`（部署後以實際網域為準） |
| `AUTH_URL` | 與 `NEXTAUTH_URL` 相同（建議一併設定） |
| `GOOGLE_CLIENT_ID` | Google OAuth 用戶端 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 密鑰 |
| `ADMIN_EMAILS` | 管理者 Gmail，逗號分隔 |
| `OPENAI_API_KEY` | 選填；未設則僅摘錄模式 |
| `OPENAI_MODEL` | 選填，預設 `gpt-4o-mini` |
| `OPENAI_EMBEDDING_MODEL` | 選填，預設 `text-embedding-3-small` |
| `OPENAI_DISABLED` | 選填，`true` 強制關閉 OpenAI |
| `RAG_FETCH_K` / `RAG_TOP_K` / `RAG_MMR_LAMBDA` | 選填 RAG 參數 |

5. **Deploy**。建置指令為 `npm run build`（內含 `prisma generate`），**不會**自動執行 `db:push` 或種子資料。

---

## 三、Google OAuth 正式網域

在 [Google Cloud 憑證](https://console.cloud.google.com/apis/credentials?project=government-procurement-act2) 編輯您的 **OAuth 2.0 用戶端 ID**：

**已授權的 JavaScript 來源**（新增）：

```
https://你的專案.vercel.app
```

**已授權的重新導向 URI**（新增，路徑必須完全一致）：

```
https://你的專案.vercel.app/api/auth/callback/google
```

本機開發仍保留：

```
http://localhost:3000
http://localhost:3000/api/auth/callback/google
```

外部應用程式若為「測試」狀態，請在 OAuth 同意畫面將登入用 Gmail 加入 **測試使用者**（見 `GOOGLE-OAUTH.md`）。

---

## 四、初始化正式資料庫（本機執行一次）

部署成功後，**在您的開發機**對 **Neon 的 `DATABASE_URL`** 執行（勿把連線字串寫進程式碼或 commit）：

```powershell
cd C:\Users\sport\gov-procurement-law-tutor

# 僅此次在 PowerShell 設定（或暫時寫入 .env，勿 push）
$env:DATABASE_URL = "postgresql://..."   # Neon 連線字串

npm install
npm run db:push      # 建立資料表
npm run db:seed      # 種子法規清單
npm run corpus:rag-init   # 匯入 corpus + 產生 embedding（需 OPENAI_API_KEY，否則 embed 可能略過）
```

說明：

- `db:push`：依 `prisma/schema.prisma` 同步結構到 Postgres
- `db:seed`：寫入 `Regulation` 等基本資料
- `corpus:rag-init`：等同 `corpus:ingest` + `corpus:embed`；語意檢索需 embedding，請確認本機 `.env` 有 `OPENAI_API_KEY` 再執行

之後若只更新 `data/corpus/*.md`，可再執行：

```powershell
$env:DATABASE_URL = "postgresql://..."
npm run corpus:ingest
npm run corpus:embed
```

---

## 五、本機開發（PostgreSQL）

1. 複製環境檔：`copy .env.example .env`（PowerShell 亦可用 `Copy-Item`）
2. 設定 `DATABASE_URL` 指向本機或 Neon：
   - **Docker Postgres**（建議與正式環境一致）：

     ```powershell
     docker compose up -d
     ```

     `.env`：

     ```env
     DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gov_procurement"
     ```

     （亦可單行：`docker run -d --name gpa-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gov_procurement -p 5432:5432 postgres:16`）

3. 初始化：

   ```powershell
   powershell -File .\init-db.ps1
   # 或
   npm run db:init
   npm run corpus:rag-init
   ```

4. 啟動：`npm run dev` 或 `powershell -File .\start-dev.ps1`

舊版 SQLite（`file:./dev.db`）已不再支援；若本機仍有 `prisma/dev.db` 可刪除，僅作備份用途。

---

## 六、檢查清單

- [ ] Neon 專案已建立，`DATABASE_URL` 已貼到 Vercel
- [ ] Vercel 已設定 `NEXTAUTH_SECRET`、`NEXTAUTH_URL`（https）、Google OAuth
- [ ] Google 重新導向 URI 含正式網域 `/api/auth/callback/google`
- [ ] 已對正式 DB 執行 `db:push`、`db:seed`、`corpus:rag-init`（或至少 ingest）
- [ ] 瀏覽器可開啟 `/regulations` 且非「資料庫尚未初始化」
- [ ] Google 登入與管理員信箱（`ADMIN_EMAILS`）正常

---

## 常見問題

| 現象 | 處理 |
|------|------|
| 建置失敗、Prisma 錯誤 | 確認 Vercel 有 `DATABASE_URL`；Node 版本 ≥ 20（見 `package.json` engines） |
| 頁面顯示資料庫未就緒 | 對 Neon 執行 `npm run db:push` 與 `db:seed` |
| `redirect_uri_mismatch` | Google 重新導向 URI 與 `NEXTAUTH_URL` 網域一致 |
| 回答無語意檢索 | 對正式 DB 執行 `corpus:embed` 並設定 `OPENAI_API_KEY` |
| 本機無法連線 DB | 檢查 Docker 是否啟動、防火牆、Neon IP 允許與 `sslmode` |
| `P1012` / `file:` / SQLite URL | 將 `.env` 的 `DATABASE_URL` 改為 `postgresql://...`（執行 `powershell -File .\check-env.ps1` 檢查） |

---

## 相關檔案

- `prisma/schema.prisma` — 資料模型（PostgreSQL）
- `.env.example` — 環境變數範本
- `GOOGLE-OAUTH.md` — Google 登入詳細設定
