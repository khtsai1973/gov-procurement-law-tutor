# Google 登入設定（修正 invalid_client / OAuth client was not found）



錯誤 **401 invalid_client** 表示 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 仍是占位字，或與 Google Cloud 上的用戶端不一致。



## 1. 使用您的 Google Cloud 專案



專案名稱：**government-procurement-act2**



直接開啟憑證頁：



https://console.cloud.google.com/apis/credentials?project=government-procurement-act2



---



## 2. OAuth 同意畫面：測試中 vs 正式版



| 發布狀態 | 誰能登入 | 適用情境 |

|----------|----------|----------|

| **測試中**（Testing） | 僅「測試使用者」清單內的 Gmail（上限約 100 人） | 本機開發、小團隊試用 |

| **正式版**（In production） | 任何 Google 帳號（依您設定的範圍） | **公開網站**（Vercel 正式網域） |



### 2a. 測試中（本機或小範圍試用）



1. 左側：**API 和服務** → **OAuth 同意畫面**

2. 使用者類型選 **外部**

3. 填寫應用程式名稱、使用者支援電子郵件

4. **測試使用者** → **新增使用者** → 輸入允許登入的 Gmail → **儲存**  

   （未在清單內的帳號會出現 `AccessDenied`）

5. 儲存整個同意畫面設定



直接開啟同意畫面：  

https://console.cloud.google.com/apis/credentials/consent?project=government-procurement-act2



### 2b. 正式版（公開給所有使用者）



若要讓 **任意 Google 使用者** 在正式網域登入，須將同意畫面 **發布為正式版**：



1. 開啟 [OAuth 同意畫面](https://console.cloud.google.com/apis/credentials/consent?project=government-procurement-act2)

2. 確認已填：應用程式名稱、使用者支援電子郵件、開發人員聯絡資訊

3. **範圍（Scopes）**：至少包含 `openid`、`email`、`profile`（Google 登入預設）

4. 若 Google 要求 **隱私權政策**、**服務條款** URL，請填可公開存取的網址（可先用專案說明頁或組織官網）

5. 按 **發布應用程式**（Publish app）→ 確認改為 **正式版**

6. 若應用程式請求敏感／受限範圍，可能需 **Google 驗證**（一般 Google 登入通常不需額外審核）



> **注意**：正式版上線後，不必再維護「測試使用者」清單；任何使用者皆可登入（仍須通過 Google 帳號驗證）。



---



## 3. 建立 OAuth 用戶端 ID



1. **API 和服務** → **憑證** → **建立憑證** → **OAuth 用戶端 ID**

2. 應用程式類型：**網頁應用程式**

3. 名稱：任意（例如 `gov-procurement-tutor`）



**已授權的 JavaScript 來源**（本機與正式可同時列多行）：



```

http://localhost:3000

https://你的專案.vercel.app

```



**已授權的重新導向 URI**（路徑必須一字不差）：



```

http://localhost:3000/api/auth/callback/google

https://你的專案.vercel.app/api/auth/callback/google

```



4. 建立後複製 **用戶端 ID** 與 **用戶端密鑰**



---



## 4. 寫入環境變數



### 本機（`.env`）



```env

GOOGLE_CLIENT_ID="貼上用戶端ID.apps.googleusercontent.com"

GOOGLE_CLIENT_SECRET="貼上用戶端密鑰"

NEXTAUTH_URL="http://localhost:3000"

AUTH_URL="http://localhost:3000"

```



### Vercel（Production）



在 Vercel → Settings → Environment Variables 設定相同鍵名，`NEXTAUTH_URL` / `AUTH_URL` 改為：



```env

NEXTAUTH_URL="https://你的專案.vercel.app"

AUTH_URL="https://你的專案.vercel.app"

```



勿保留 `replace-with-google-oauth-client-id` 這類占位字。



---



## 5. 重啟／重新部署



**本機：**



```powershell

cd C:\Users\sport\gov-procurement-law-tutor

# Ctrl+C 停止舊的 dev

npm run dev

```



**Vercel：** 變更環境變數或 Google 重新導向 URI 後，在 Dashboard 按 **Redeploy**。



---



## 常見問題



| 現象 | 處理方式 |

|------|----------|

| OAuth client was not found | Client ID 錯誤或仍是占位字 |

| redirect_uri_mismatch | 重新導向 URI 必須完全一致（含 `/api/auth/callback/google`）；`NEXTAUTH_URL` 網域須一致 |

| access_denied | **測試中**：將 Gmail 加入「測試使用者」；**公開站**：改發布為「正式版」 |

| 登入後不是管理者 | 確認 `ADMIN_EMAILS` 含該 Gmail（Vercel 亦須設定） |

| 本機可登入、正式站不行 | 檢查 Vercel 的 `NEXTAUTH_URL`、Google 是否已加正式網域 URI、OAuth 是否仍為測試中 |



---



## 相關文件



- `DEPLOY.md` — Neon + Vercel 完整部署

- `/auth/setup` — 依目前站點 URL 顯示應填的重新導向 URI

