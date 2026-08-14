# Faithfulness + Relevance + Citation Accuracy（FRC）

期末報告核心生成品質三指標，以 TypeScript 啟發式實作（可離線重現）。

## 定義

| 指標 | 意義 | 實作 |
|------|------|------|
| **Faithfulness** | 答案主張是否可由檢索／金標上下文支撐（防幻覺） | `scoreFaithfulness`（`must_include`＋短句支撐） |
| **Relevance** | 答案是否對準使用者問題 | `scoreAnswerRelevance`（關鍵詞覆蓋） |
| **Citation Accuracy** | 是否正確引用預期條號／來源（可含 `[片段N]`） | `scoreCitationAccuracyDetailed` |

統一入口：`scoreFRC()`（`src/lib/rag-eval/frc.ts`）

### Citation Accuracy 組成

1. **article_hit**：`expected_articles` 是否出現在答案  
2. **source_hit**：`expected_sources`（slug／法規名）是否出現  
3. **fragment_marker**（可選）：是否含 `[片段N]`；僅有條號時給部分分  

OOD 拒答（`非本主題的範圍`）不計 Citation（回傳 `null`）。

## 指令

```bash
# FRC 專項（Golden Phase1）
npm run test:rag-frc
npm run rag:eval:frc

# Live 子集（真實檢索＋生成）
RAG_FRC_MODE=live RAG_FRC_LIMIT=15 npm run rag:eval:frc

# 整輪 live suite
npm run rag:eval:live
```

產出：`docs/evidence/rag-frc-latest.{md,json}`

## 與策略比較的關係

- `rag:eval:compare`：偏檢索（Hit Rate／Latency）；加 `RAG_COMPARE_GENERATE=1` 才有完整 F／R／C  
- `rag:eval:frc`：專注生成品質三指標（離線金標自洽；`RAG_FRC_MODE=live` 接真實管線）
- `rag:eval:live`：一輪 suite，見 [`docs/RAG-LIVE-SUITE.md`](./RAG-LIVE-SUITE.md)

## 門檻（預設）

| 指標 | 門檻 |
|------|------|
| Faithfulness | ≥ 0.70 |
| Relevance | ≥ 0.70 |
| Citation Accuracy | ≥ 0.65 |
