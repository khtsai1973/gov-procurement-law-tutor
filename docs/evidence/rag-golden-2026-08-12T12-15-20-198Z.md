# RAG 評測報告（Ragas 風格）

- 產生時間：2026-08-12T12:15:20.198Z
- 模式：`offline`
- 框架：ragas-inspired-ts
- 門檻：Faithfulness ≥ 0.7；Answer Relevance ≥ 0.65；頁面 TTFB p95 < 500 ms

## 摘要

| 指標 | 平均 |
| --- | ---: |
| Faithfulness（忠實度） | 0.973 |
| Answer Relevance（相關性） | 1 |
| Context Recall（參考） | 0.93 |
| 案例數 | 50 |
| 判定 | ✅ 通過 |

## 分案

| ID | Faith. | Relev. | Recall | 模型 |
| --- | ---: | ---: | ---: | --- |
| `G001` | 1 | 1 | 1 | gold-self |
| `G002` | 1 | 1 | 1 | gold-self |
| `G003` | 1 | 1 | 1 | gold-self |
| `G004` | 0.783 | 1 | 1 | gold-self |
| `G005` | 1 | 1 | 1 | gold-self |
| `G006` | 1 | 1 | 1 | gold-self |
| `G007` | 0.783 | 1 | 0.667 | gold-self |
| `G008` | 0.838 | 1 | 1 | gold-self |
| `G009` | 1 | 1 | 1 | gold-self |
| `G010` | 1 | 1 | 1 | gold-self |
| `G011` | 1 | 1 | 1 | gold-self |
| `G012` | 1 | 1 | 1 | gold-self |
| `G013` | 1 | 1 | 1 | gold-self |
| `G014` | 1 | 1 | 1 | gold-self |
| `G015` | 1 | 1 | 1 | gold-self |
| `G016` | 1 | 1 | 1 | gold-self |
| `G017` | 0.783 | 1 | 0.667 | gold-self |
| `G018` | 1 | 1 | 1 | gold-self |
| `G019` | 1 | 1 | 1 | gold-self |
| `G020` | 1 | 1 | 1 | gold-self |
| `G021` | 1 | 1 | 1 | gold-self |
| `G022` | 1 | 1 | 1 | gold-self |
| `G023` | 1 | 1 | 1 | gold-self |
| `G024` | 1 | 1 | 1 | gold-self |
| `G025` | 1 | 1 | 1 | gold-self |
| `G026` | 1 | 1 | 1 | gold-self |
| `G027` | 1 | 1 | 1 | gold-self |
| `G028` | 0.838 | 1 | 0.75 | gold-self |
| `G029` | 1 | 1 | 1 | gold-self |
| `G030` | 1 | 1 | 1 | gold-self |
| `G031` | 1 | 1 | 1 | gold-self |
| `G032` | 1 | 1 | 1 | gold-self |
| `G033` | 1 | 1 | 1 | gold-self |
| `G034` | 0.783 | 1 | 0.667 | gold-self |
| `G035` | 1 | 1 | 1 | gold-self |
| `G036` | 1 | 1 | 1 | gold-self |
| `G037` | 1 | 1 | 1 | gold-self |
| `G038` | 1 | 1 | 1 | gold-self |
| `G039` | 1 | 1 | 1 | gold-self |
| `G040` | 1 | 1 | 1 | gold-self |
| `G041` | 1 | 1 | 1 | gold-self |
| `G042` | 1 | 1 | 1 | gold-self |
| `G043` | 1 | 1 | 1 | gold-self |
| `G044` | 1 | 1 | 1 | gold-self |
| `G045` | 1 | 1 | 1 | gold-self |
| `G046` | 0.838 | 1 | 0.75 | gold-self |
| `G047` | 1 | 1 | 1 | gold-self |
| `G048` | 1 | 1 | 1 | gold-self |
| `G049` | 1 | 1 | 0 | gold-self |
| `G050` | 1 | 1 | 0 | gold-self |

## 指標定義

- **Faithfulness**：回答關鍵事實是否可由檢索／金標上下文支撐（防幻覺）。
- **Answer Relevance**：回答是否對準使用者採購法問題。
- **Latency**：頁面暖機 TTFB p95 < 0.5s（`npm run ttfb:check`）；問答採 SSE 串流降低體感等待。

> golden dataset phase1; citation_accuracy_mean=0.826; refuse_accuracy=1; coverage={"法條直接查詢":{"ready":8,"planned":7},"採購金額／門檻判斷":{"ready":5,"planned":5},"招標方式":{"ready":5,"planned":5},"決標方式":{"ready":5,"planned":5},"限制性招標／第22條":{"ready":5,"planned":5},"履約／驗收":{"ready":5,"planned":5},"情境案例題":{"ready":7,"planned":8},"跨條文／跨文件題":{"ready":5,"planned":5},"錯誤前提題":{"ready":3,"planned":2},"Out-of-domain":{"ready":2,"planned":3}}

重跑：`npm run rag:eval` 或 `RAG_EVAL_MODE=live npm run rag:eval`

## Golden 補充指標

| Citation Accuracy（條號命中） | 0.826 |
| 拒答正確率 | 1 |
| Phase1 ready | 50 |
| Phase2 planned | 50 |
