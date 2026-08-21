# Baseline / Contextual / Parent-Document RAG 比較

期末報告用策略消融實驗：在同一 Golden Dataset（預設 50 題；`RAG_COMPARE_LIMIT=0` 可跑全部 ready，目前 200）上比較三種檢索策略。

完整期末總表請用 [`docs/RAG-BENCHMARK.md`](./RAG-BENCHMARK.md)（`npm run rag:benchmark`）。

## 策略定義（本站實作）

| 策略 | 行為 |
|------|------|
| **baseline** | 只回傳 CHILD 命中；不做 Parent 展開、細則擴充、GraphRAG |
| **contextual** | CHILD 命中後，依條號擴充關聯《施行細則》等 Parent（**不**展開母法 Parent） |
| **parent_contextual** | CHILD → Parent 展開＋細則擴充；生產環境另可開 GraphRAG |

生產問答預設：`parent_contextual` + GraphRAG（與合併前行為一致）。

> **限制（請寫進報告）**：三種策略共用同一套已含 Contextual 前綴的 Child 索引。真正的「無前綴 Baseline」需另做扁平 ingest；本比較先消融「查詢時展開／擴充」層。

## 指標

| 指標 | 說明 |
|------|------|
| Retrieval Hit Rate | `expected_sources`／`expected_articles` 是否出現在檢索結果 |
| Citation Accuracy | 生成答案是否寫出預期條號（需 `RAG_COMPARE_GENERATE=1`） |
| Faithfulness / Relevance | 既有 rag-eval 啟發式（需生成答案） |
| 拒答正確率 | OOD 題是否回「非本主題的範圍」 |
| Latency p50／p95 | 每題檢索（±生成）耗時 |

## 指令

```bash
# CI／無 DB：fixture 模擬策略展開
npm run rag:eval:compare

# 有資料庫：真實檢索（建議先關閉 Graph 做公平三方）
DATABASE_URL=... npm run rag:eval:compare

# 含 LLM 生成（Faithfulness／Citation）
RAG_COMPARE_GENERATE=1 DATABASE_URL=... npm run rag:eval:compare

# 單元測試
npm run test:rag-compare
```

環境變數：

- `RAG_COMPARE_MODE=live|fixture`
- `RAG_COMPARE_STRATEGIES=baseline,contextual,parent_contextual`
- `RAG_COMPARE_LIMIT=50`（`0`＝全部 ready）
- `RAG_COMPARE_ENABLE_GRAPH=0`（預設關）
- `RAG_COMPARE_GENERATE=0|1`
- `RAG_COMPARE_TOP_K=8`

產出：`docs/evidence/rag-compare-latest.{md,json}`

## 程式入口

- 策略展開：`applyRetrievalStrategy` / `retrieveForRag(..., { strategy })`（`src/lib/rag.ts`）
- 比較邏輯：`src/lib/rag-eval/compare.ts`
- 腳本：`scripts/rag-eval-compare.ts`
