# Live RAG 評測一輪（Suite）

將 **smoke live**、**Golden compare live**、**FRC** 串成單一指令，並由 GitHub Actions 每週排程執行。

## 一鍵重跑

```bash
# 排程預設：compare 檢索 live（50 題）+ FRC 離線金標（不需 OpenAI）
npm run rag:eval:live

# 完整 live（smoke + compare 生成 + FRC live）
RAG_LIVE_SUITE_GENERATE=1 npm run rag:eval:live
```

產出：

- `docs/evidence/rag-live-suite-latest.{md,json}` — 整輪摘要
- `rag-eval-latest.*` — smoke（`data/rag-eval/cases.json`）
- `rag-compare-latest.*` — 策略比較（預設 Golden 50；Benchmark 可全量 200）
- `rag-frc-latest.*` — FRC 三指標

離線期末總表請用 [`RAG-BENCHMARK.md`](./RAG-BENCHMARK.md)（`npm run rag:benchmark`）。

## 步驟說明

| 步驟 | 腳本 | `GENERATE=0`（排程預設） | `GENERATE=1` |
|------|------|------------------------|--------------|
| eval | `rag:eval` | 略過 | live smoke（需 OpenAI） |
| compare | `rag:eval:compare` | live 檢索 | live + 生成 |
| frc | `rag:eval:frc` | 離線金標 | live 子集 |

## 環境變數

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | 必填 |
| `OPENAI_API_KEY` | `GENERATE=1` 或含 `eval` 步驟時必填 |
| `RAG_LIVE_SUITE_GENERATE` | `0`（預設，compare+frc）／`1`（eval+compare+frc live） |
| `RAG_LIVE_SUITE_STEPS` | 預設隨 `GENERATE`；可覆寫如 `eval,compare,frc` |
| `RAG_LIVE_SUITE_COMPARE_LIMIT` | 預設 `50` |
| `RAG_FRC_LIMIT` | FRC 題數；live 預設 `15` |
| `RAG_LIVE_SUITE_FAIL_FAST` | 預設 `1`（任一步失敗整輪 exit 1） |

## GitHub Actions 排程

Workflow：`.github/workflows/rag-live-eval.yml`

- **排程**：每週一 02:15 UTC（`RAG_LIVE_SUITE_GENERATE=0`）
- **手動**：Actions → RAG Live Eval → Run workflow（可勾選含 LLM 生成）
- **Secrets**：`DATABASE_URL`（必填）；`OPENAI_API_KEY`（僅手動 `generate=true` 時需要）
- **產物**：上傳 `rag-live-evidence-*` artifact（保留 30 天），不寫入 repo

未設定 `DATABASE_URL` secret 時 workflow 會跳過並標記 skip。

## 與其他文件

- 指標定義：[`RAG-EVAL.md`](./RAG-EVAL.md)
- FRC live：`RAG_FRC_MODE=live npm run rag:eval:frc`
- 策略比較：[`RAG-COMPARE.md`](./RAG-COMPARE.md)
