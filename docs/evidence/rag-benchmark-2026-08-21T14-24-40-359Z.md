# RAG Benchmark 總表

- 產生時間：2026-08-21T14:24:40.359Z
- 資料集：Golden 200/200（v2.0.1-200）
- 整體 pass：true

## 步驟

| 步驟 | 狀態 | 摘要 |
|------|------|------|
| `golden` | ✅ | pass FRC=0.967 |
| `frc` | ✅ | n=200 FRC=0.967 pass=true |
| `compare` | ✅ | fixture strategies=3 limit=0 |

## Golden／FRC（標註品質＋指標自洽）

| 來源 | n | Faithfulness | Relevance | Citation | FRC | 拒答 | pass |
|------|---|--------------|-----------|----------|-----|------|------|
| golden | 200 | 0.967 | 0.98 | 0.963 | 0.967 | 1 | true |
| frc | 200 | 0.967 | 0.98 | 0.963 | 0.967 | — | true |

## 策略比較（Baseline／Contextual／Parent-Document）

- 模式：`fixture`；生成：no；Graph：off

| strategy | n | Hit Rate | Citation | Faithfulness | Relevance | Refuse | p50 | p95 |
|----------|---|----------|----------|--------------|-----------|--------|-----|-----|
| `baseline` | 200 | 0.45 | — | 1 | 1 | 1 | 0 | 0 |
| `contextual` | 200 | 0.45 | — | 1 | 1 | 1 | 0 | 0 |
| `parent_contextual` | 200 | 0.45 | — | 1 | 1 | 1 | 0 | 0 |

## 注意事項

- Golden ready=200 planned=0（phase1=50 phase2=50 phase3=100）。
- Golden／FRC 預設以 gold_answer 離線自洽，驗證標註與指標門檻。
- Compare 為 fixture：驗證策略展開與 Hit Rate 管線，非正式全量語料結果。
- 三方策略比較預設關閉 GraphRAG，以免 parent_contextual 雙重加分。
- 詳見 docs/RAG-BENCHMARK.md、docs/RAG-COMPARE.md、docs/RAG-FRC.md。


## 重跑

```bash
npm run rag:benchmark
RAG_BENCHMARK_COMPARE_LIMIT=50 npm run rag:benchmark
RAG_BENCHMARK_COMPARE_MODE=live DATABASE_URL=... npm run rag:benchmark
```
