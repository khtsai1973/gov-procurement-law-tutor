# RAG Benchmark（期末報告總表）

在 **200 題 Golden Dataset** 上，一鍵彙整：

1. **Golden** 離線評測（`gold_answer` 自洽）  
2. **FRC**（Faithfulness＋Relevance＋Citation）  
3. **策略比較**（Baseline／Contextual／Parent-Document）

產出單一總表，方便寫進期末報告。

## 一鍵重跑

```bash
# 離線（無 DB）：Golden＋FRC＋fixture 策略比較（全量 200）
npm run rag:benchmark

# 單元測試
npm run test:rag-benchmark

# Compare 子集（較快）
RAG_BENCHMARK_COMPARE_LIMIT=50 npm run rag:benchmark

# Live 檢索比較（需 DATABASE_URL）
RAG_BENCHMARK_COMPARE_MODE=live DATABASE_URL=... npm run rag:benchmark

# Live＋LLM 生成（Citation／Faithfulness 對真實答案）
RAG_BENCHMARK_COMPARE_MODE=live RAG_COMPARE_GENERATE=1 DATABASE_URL=... OPENAI_API_KEY=... npm run rag:benchmark
```

產出：

- `docs/evidence/rag-benchmark-latest.{md,json}` — **總表**
- 同步更新：`rag-golden-latest.*`、`rag-frc-latest.*`、`rag-compare-latest.*`

## 環境變數

| 變數 | 說明 |
|------|------|
| `RAG_BENCHMARK_STEPS` | 預設 `golden,frc,compare` |
| `RAG_BENCHMARK_COMPARE_LIMIT` | 預設 `0`＝全部 ready；可設 `50` 等 |
| `RAG_BENCHMARK_COMPARE_MODE` | `fixture`／`live`（未設則有 DB 走 live） |
| `RAG_BENCHMARK_FAIL_FAST` | 預設 `1` |
| `RAG_COMPARE_GENERATE` | 傳給 compare（`0`／`1`） |
| `RAG_COMPARE_ENABLE_GRAPH` | 傳給 compare（公平三方建議 `0`） |

## 與其他腳本的關係

| 腳本 | 用途 |
|------|------|
| `rag:benchmark` | **報告總表**（本文件） |
| `rag:eval:golden` | 僅 Golden |
| `rag:eval:frc` | 僅 FRC |
| `rag:eval:compare` | 僅策略比較 |
| `rag:eval:live` | 有 DB 的一輪 live suite（排程用） |

資料集：[`docs/RAG-GOLDEN.md`](./RAG-GOLDEN.md)  
指標：[`docs/RAG-FRC.md`](./RAG-FRC.md)、[`docs/RAG-COMPARE.md`](./RAG-COMPARE.md)
