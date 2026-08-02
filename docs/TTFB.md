# TTFB < 0.5 秒：如何處理與如何提出證據

## 結論（怎麼處理）

1. **把合格範圍講清楚**：以「暖機後（warm / steady-state）」匿名公開頁為準——首頁 `/`、註冊頁 `/register`。Serverless／Neon 冷啟動可能 > 0.5s，應單獨標示，不與暖機態混用。
2. **拿掉公開頁的 server session／DB**：root layout 不 `force-dynamic`；`Nav`／首頁／註冊頁改客戶端讀 `useSession`，避免每個請求等 Auth／Postgres。
3. **縮小 serverless 打包**：`outputFileTracingIncludes` 勿掛在 `"/*"`，只掛管理／匯入相關路徑，降低冷啟動與函式體積。
4. **暖機**：`GET /api/health`（不連 DB）可供 cron 或量測腳本預熱。
5. **可重現證據**：用 `npm run ttfb:check` 產出 `docs/evidence/ttfb-*.md`／`.json`（含 p50／p95）。

## 合格定義（建議寫進驗收）

| 項目 | 定義 |
| --- | --- |
| 路徑 | `/`、`/register`（匿名、未登入） |
| 指標 | TTFB = HTTP 回應首個 byte 時間（`curl` `time_starttransfer`） |
| 狀態 | 暖機後連續 N 次（預設 20） |
| 門檻 | **p95 < 500 ms** |
| 排除 | 冷啟動、需登入頁、`/regulations` 等 DB 列表頁 |

## 重跑量測

```bash
# 預設打 production
npm run ttfb:check

# 自訂
BASE_URL=https://gov-procurement-law-tutor.vercel.app \
TTFB_WARM_N=20 \
THRESHOLD_MS=500 \
npm run ttfb:check
```

產出：

- `docs/evidence/ttfb-latest.md` — 給驗收看的摘要
- `docs/evidence/ttfb-latest.json` — 原始統計
- 帶時間戳的同名檔 — 留存歷史

## 部署後再量一次

程式優化合併至 `main` 並完成 Vercel Production 部署後，再執行 `ttfb:check`，把新的 `ttfb-*.md` 當作正式證據附件。
