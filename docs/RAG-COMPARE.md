# Baseline / Contextual / Parent / Combined RAG 比較

期末報告用策略消融實驗：在同一 Golden Dataset（`RAG_COMPARE_LIMIT=0`＝全部 ready，目前 200）上比較四種檢索策略。

完整期末總表請用 [`docs/RAG-BENCHMARK.md`](./RAG-BENCHMARK.md)（`npm run rag:benchmark`）。

## 策略定義（本站實作）

| 策略 | 報告欄名 | 行為 |
|------|----------|------|
| **baseline** | Baseline | 只回傳 CHILD 命中；不做 Parent 展開、細則擴充、GraphRAG |
| **contextual** | Contextual | CHILD 命中後，依條號擴充關聯《施行細則》等 Parent（**不**展開母法 Parent） |
| **parent_contextual** | Parent | CHILD → Parent 展開＋細則擴充；比較實驗預設**關** GraphRAG |
| **combined** | Combined | Parent＋Contextual＋**GraphRAG**（≈生產問答預設） |

> **限制（請寫進報告）**：四種策略共用同一套已含 Contextual 前綴的 Child 索引。真正的「無前綴 Baseline」需另做扁平 ingest；本比較先消融「查詢時展開／擴充／Graph」層。

## 指標對照表（實測範例）

最新 live 結果見 [`docs/evidence/rag-compare-latest.md`](./evidence/rag-compare-latest.md)（n=200，BM25-only＋摘錄 fallback；無 OpenAI 時 Faithfulness／Citation 以檢索摘錄評分）：

| 指標 | Baseline | Contextual | Parent | Combined |
|------|----------|------------|--------|----------|
| Retrieval Hit Rate | 0.840 | 0.850 | 0.853 | 0.854 |
| Faithfulness | 0.830 | 0.830 | 0.836 | 0.836 |
| Relevance | 0.793 | 0.793 | 0.803 | 0.803 |
| Citation Accuracy | 0.759 | 0.759 | 0.738 | 0.738 |
| Latency p50 (ms) | 182 | 181 | 180 | 195 |

有 `OPENAI_API_KEY` 且未設 `OPENAI_DISABLED` 時，可重跑以取得 LLM 生成答案上的 F／R／C。

## 指令

```bash
# CI／無 DB：fixture 模擬策略展開
npm run rag:eval:compare

# 有資料庫：真實檢索＋生成（建議 Parent 關 Graph；Combined 仍開）
RAG_COMPARE_MODE=live RAG_COMPARE_GENERATE=1 RAG_COMPARE_LIMIT=0 \
  RAG_COMPARE_STRATEGIES=baseline,contextual,parent_contextual,combined \
  DATABASE_URL=... npm run rag:eval:compare

# 單元測試
npm run test:rag-compare
```

環境變數：

- `RAG_COMPARE_MODE=live|fixture`
- `RAG_COMPARE_STRATEGIES=baseline,contextual,parent_contextual,combined`
- `RAG_COMPARE_LIMIT=50`（`0`＝全部 ready）
- `RAG_COMPARE_ENABLE_GRAPH=0`（僅影響 Parent 欄；Combined 一律開 Graph）
- `RAG_COMPARE_GENERATE=0|1`
- `RAG_COMPARE_TOP_K=8`

產出：`docs/evidence/rag-compare-latest.{md,json}`

## 程式入口

- 策略展開：`applyRetrievalStrategy` / `retrieveForRag(..., { strategy })`（`src/lib/rag.ts`）
- 比較邏輯：`src/lib/rag-eval/compare.ts`
- 腳本：`scripts/rag-eval-compare.ts`
