# RAG Golden Dataset（期末報告用）

專門「考 RAG」的金標題庫，用於比較不同檢索／生成管線的研究價值。

## 規模

| 階段 | 題數 | 狀態 |
|------|------|------|
| Phase 1 | **50**（G001–G050） | `status: ready` |
| Phase 2 | **50**（G051–G100） | `status: ready` |
| Phase 3 | **100**（G101–G200） | `status: ready` |
| **合計** | **200** | 全部可跑自動評測 |

資料檔：[`data/rag-eval/golden/dataset.json`](../data/rag-eval/golden/dataset.json)

## 題型配置

| 類型 | 總計 | Phase1 | Phase2 | Phase3 |
|------|------|--------|--------|--------|
| ① 法條直接查詢 | 30 | 8 | 7 | 15 |
| ② 採購金額／門檻判斷 | 20 | 5 | 5 | 10 |
| ③ 招標方式 | 20 | 5 | 5 | 10 |
| ④ 決標方式 | 20 | 5 | 5 | 10 |
| ⑤ 限制性招標／第22條 | 20 | 5 | 5 | 10 |
| ⑥ 履約／驗收 | 20 | 5 | 5 | 10 |
| ⑦ 情境案例題 | 30 | 7 | 8 | 15 |
| ⑧ 跨條文／跨文件題 | 20 | 5 | 5 | 10 |
| ⑨ 錯誤前提題 | 10 | 3 | 2 | 5 |
| ⑩ Out-of-domain | 10 | 2 | 3 | 5 |

## 每題欄位

- `id`：G001…
- `category` / `difficulty`
- `question` / `gold_answer`
- `expected_sources`（corpus slug 或法規名）
- `expected_articles`
- `expected_behavior`：`answer`｜`correct`｜`refuse`
- `notes`
- `must_include`（評測輔助）
- `phase` / `status`

## 自動評測

`listReadyGoldenItems()` 回傳全部 `status: ready`（目前 200 題），供 Golden／FRC 腳本使用：

```bash
npm run test:rag-golden
npm run rag:eval:golden
npm run rag:eval:frc

# 期末報告總表（含策略比較）
npm run rag:benchmark
```

離線模式以 `gold_answer` 自評（FRC／faithfulness）；線上模式需 `DATABASE_URL`。詳見 [`docs/RAG-BENCHMARK.md`](./RAG-BENCHMARK.md)。

## 建議管線比較

1. Baseline RAG  
2. Contextual RAG  
3. Parent-Document + Contextual RAG（可再加 Hybrid／GraphRAG）

詳見 [`docs/RAG-COMPARE.md`](./RAG-COMPARE.md)：

```bash
npm run test:rag-compare
npm run rag:eval:compare
```

## 指標

- **Faithfulness、Relevance、Citation Accuracy（FRC）** — 見 [`docs/RAG-FRC.md`](./RAG-FRC.md)  
- Retrieval Hit Rate、拒答正確率、Latency — 見策略比較  

## 與既有 `cases.json` 的關係

- `data/rag-eval/cases.json`：精簡 CI smoke（門檻、監辦、離題等）  
- `data/rag-eval/golden/dataset.json`：**研究用完整金標集（200 題）**  

兩者並存；期末報告以 Golden Dataset 為主。
