# RAG 評測指標（Ragas 風格）

本站以 **TypeScript 實作 Ragas 語意指標**（Faithfulness／Answer Relevance），避免引入沉重 Python 依賴；可離線重現，亦可對真實檢索＋作答跑 live 評測。

## 指標

| 指標 | 意義 | 門檻（預設） |
|------|------|-------------|
| **Faithfulness（忠實度）** | 回答關鍵事實是否可由檢索／金標法條上下文支撐 | mean ≥ 0.70 |
| **Answer Relevance（相關性）** | 回答是否精準對準使用者採購法問題 | mean ≥ 0.70 |
| **Citation Accuracy（引文正確率）** | 預期條號／來源是否出現在答案（可含片段標註） | mean ≥ 0.65（見 FRC） |
| **Context Recall（參考）** | 金標要件是否出現在上下文 | 報告用 |
| **Latency** | 頁面暖機 TTFB p95 &lt; 0.5s；問答採 SSE 串流 | `npm run ttfb:check` |

## 重跑

```bash
# 離線（確定性答案＋金標上下文，CI／無 DB 可用）
npm run rag:eval

# 真實管線（需 DATABASE_URL；建議先 corpus:ingest）
RAG_EVAL_MODE=live npm run rag:eval

# 延遲證據（頁面 TTFB）
npm run ttfb:check
```

產出：

- `docs/evidence/rag-eval-latest.md` / `.json`
- 串流：`POST /api/chat` 設 `stream: true` 或 `Accept: text/event-stream`

## 金標案例

- **CI smoke**：`data/rag-eval/cases.json`（門檻數字、小額、金額認定、監辦、決標原則、離題拒答、公開招標三家、第22條第9款範圍等）。
- **研究用 Golden Dataset（200 題 ready）**：見 [`docs/RAG-GOLDEN.md`](./RAG-GOLDEN.md) 與 `data/rag-eval/golden/dataset.json`。

```bash
npm run test:rag-golden
npm run rag:eval:golden

# FRC 三指標專項
npm run test:rag-frc
npm run rag:eval:frc

# 期末報告總表（Golden＋FRC＋策略比較）
npm run test:rag-benchmark
npm run rag:benchmark

# Live 子集（真實檢索＋生成，需 DATABASE_URL、OPENAI_API_KEY）
RAG_FRC_MODE=live RAG_FRC_LIMIT=15 npm run rag:eval:frc

# 一輪 live suite（smoke + compare + FRC，見 docs/RAG-LIVE-SUITE.md）
npm run rag:eval:live

# Baseline / Contextual / Parent-Document 比較
npm run test:rag-compare
npm run rag:eval:compare
```

詳見 [`docs/RAG-BENCHMARK.md`](./RAG-BENCHMARK.md)、[`docs/RAG-FRC.md`](./RAG-FRC.md)、[`docs/RAG-COMPARE.md`](./RAG-COMPARE.md)、[`docs/RAG-LIVE-SUITE.md`](./RAG-LIVE-SUITE.md)。

## 與 Ragas 的對應

| Ragas | 本站 |
|-------|------|
| faithfulness | `scoreFaithfulness`（must_include＋短句／上下文支撐） |
| answer_relevancy | `scoreAnswerRelevance` |
| context_recall | `scoreContextRecall`（輔助） |

可選：後續接 LLM-as-judge 或官方 `ragas` Python 套件作交叉驗證；目前以可重現啟發式＋金標為主，便於 CI。
