# 政府採購法互動教學

以 Google 登入、依使用者記錄提問，並在已匯入的法規／函釋知識庫內作答（RAG + 選用 OpenAI）。

## 本機開發

1. 複製環境檔：`Copy-Item .env.example .env`
2. 設定 `DATABASE_URL`（`docker compose up -d` 本機 Postgres，或 Neon）、Google OAuth、`NEXTAUTH_SECRET`
3. 初始化資料庫：

   ```powershell
   powershell -File .\init-db.ps1
   # 或
   npm run db:init
   npm run corpus:rag-init   # 需 OPENAI_API_KEY 才有 embedding
   ```

4. 啟動：`npm run dev` → http://localhost:3000

Google 登入詳見 [GOOGLE-OAUTH.md](./GOOGLE-OAUTH.md)。

## 發布到公開網站（Publish）

本專案可部署至 **Vercel**，資料庫使用 **Neon PostgreSQL**（非 SQLite，不限 localhost）。

**完整步驟請見 [DEPLOY.md](./DEPLOY.md)**，摘要如下：

1. 在 [Neon](https://neon.tech) 建立 Postgres，取得 `DATABASE_URL`
2. 將儲存庫 Import 到 [Vercel](https://vercel.com)，設定環境變數（含 `NEXTAUTH_URL` / `AUTH_URL` 為 `https://你的網域.vercel.app`）
3. 在 Google Cloud 加入正式網域的 OAuth 重新導向 URI；**公開使用**須將 OAuth 同意畫面發布為「正式版」（見 [GOOGLE-OAUTH.md](./GOOGLE-OAUTH.md)）
4. 部署成功後，在本機對 **Neon 的 DATABASE_URL** 執行一次：`npm run db:push`、`npm run db:seed`、`npm run corpus:rag-init`

建置指令：`npm run build`（含 `prisma generate`）。無需 `vercel.json`（Next.js 預設即可）。

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 本機開發 |
| `npm run build` | 正式建置（Vercel 使用） |
| `npm run db:init` | generate + push + seed |
| `npm run corpus:rag-init` | 匯入 corpus 並產生 embedding |
| `npm run corpus:import-question-bank` | 匯入 `data/question-bank/*.json` 題庫 |
| `powershell -File .\check-env.ps1` | 檢查 .env 是否就緒 |

## 技術棧

- Next.js 15（App Router）、NextAuth v5（Google OAuth、`trustHost: true`）
- Prisma + PostgreSQL
- OpenAI（選填，RAG 語意檢索與生成回答）

## 相關文件

- [data/question-bank/README.md](./data/question-bank/README.md) — 題庫格式與新增方式
- [DEPLOY.md](./DEPLOY.md) — Vercel + Neon 部署
- [GOOGLE-OAUTH.md](./GOOGLE-OAUTH.md) — Google 登入（測試中 vs 正式版）
- [.env.example](./.env.example) — 環境變數範本
