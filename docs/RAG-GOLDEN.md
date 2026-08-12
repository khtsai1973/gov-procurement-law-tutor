# RAG Golden Dataset（期末報告用）

專門「考 RAG」的金標題庫，用於比較不同檢索／生成管線的研究價值。

## 規模

| 階段 | 題數 | 狀態 |
|------|------|------|
| Phase 1（正式測試） | **50**（G001–G050） | `status: ready`，已對照語料撰寫 |
| Phase 2（後續擴充） | **50**（G051–G100） | `status: planned` 槽位 |
| **合計** | **100** | |

資料檔：[`data/rag-eval/golden/dataset.json`](../data/rag-eval/golden/dataset.json)

## 題型配置

| 類型 | 總計 | Phase1 | Phase2 |
|------|------|--------|--------|
| ① 法條直接查詢 | 15 | 8 | 7 |
| ② 採購金額／門檻判斷 | 10 | 5 | 5 |
| ③ 招標方式 | 10 | 5 | 5 |
| ④ 決標方式 | 10 | 5 | 5 |
| ⑤ 限制性招標／第22條 | 10 | 5 | 5 |
| ⑥ 履約／驗收 | 10 | 5 | 5 |
| ⑦ 情境案例題 | 15 | 7 | 8 |
| ⑧ 跨條文／跨文件題 | 10 | 5 | 5 |
| ⑨ 錯誤前提題 | 5 | 3 | 2 |
| ⑩ Out-of-domain | 5 | 2 | 3 |

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

```bash
npm run rag:eval:frc
npm run rag:eval:golden
```

## 與既有 `cases.json` 的關係

- `data/rag-eval/cases.json`：精簡 CI smoke（門檻、監辦、離題等）  
- `data/rag-eval/golden/dataset.json`：**研究用完整金標集**  

兩者並存；期末報告以 Golden Dataset 為主。

## Phase 2 補題注意

1. 填入 `question`／`gold_answer`／sources／articles  
2. 對照 `data/corpus/` 原文後將 `status` 改為 `ready`  
3. 跑 `npm run test:rag-golden` 確認結構  
4. 更新 `meta.version`（例如 `1.1.0-phase2`）
