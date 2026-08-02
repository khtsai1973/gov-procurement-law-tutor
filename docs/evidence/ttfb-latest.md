# TTFB 證據報告

> 註：此份為優化合併前 production 暖機基線；合併部署後請再跑一次作為正式證據。


- 產生時間（UTC）：2026-08-02T13:20:22.628Z
- 目標站台：`https://gov-procurement-law-tutor.vercel.app`
- 門檻：暖機後 p95 < **500 ms**
- 暖機樣本數（每路徑）：8
- 判定範圍：匿名公開頁暖機態（steady-state）；冷啟動僅供參考

## 結果摘要

| 路徑 | 冷啟動 TTFB (ms) | warm p50 | warm p95 | warm max | HTTP | 合格 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `/` | 72.2 | 63.3 | 86.8 | 86.8 | ok | ✅ |
| `/register` | 81.4 | 57.3 | 128.7 | 128.7 | ok | ✅ |

## 整體判定

**通過**：所有評估路徑暖機 p95 < 500 ms。

## 方法說明

1. `GET /api/health` 與首頁暖機 serverless。
2. 各路徑先量測 1 次作為 cold 參考（若腳本啟動前已閒置）。
3. 再連續量測 8 次，取 `curl -w time_starttransfer` 為 TTFB。
4. 通過條件：各路徑 warm p95 < 500 ms，且樣本 HTTP 皆為 2xx/3xx。

重跑指令：

```bash
BASE_URL=https://gov-procurement-law-tutor.vercel.app npm run ttfb:check
```
