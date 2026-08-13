# 情境申論題 AI 批改（階段 3）

Rubric-Based LLM Grading：開放式採購實務情境題，依固定權重批改並回傳 JSON。

## Rubric

| 維度 | 權重 | 滿分 |
|------|------|------|
| 法條引用正確性 (`citation`) | 30% | 30 |
| 處置程序合法性 (`procedure`) | 40% | 40 |
| 邏輯連貫與公文用語 (`coherence`) | 30% | 30 |

## JSON 輸出

```json
{
  "scores": {
    "citation": { "score": 24, "max": 30, "comment": "…" },
    "procedure": { "score": 32, "max": 40, "comment": "…" },
    "coherence": { "score": 22, "max": 30, "comment": "…" }
  },
  "total": 78,
  "deductions": ["…"],
  "strengths": ["…"],
  "modelAnswer": "修正後示範回答"
}
```

## 使用

1. 登入後開啟 `/scenario-essay`
2. 選擇情境題、撰寫申論
3. 「送出 AI 批改」→ `POST /api/scenario-essay/grade`

無 API Key 或離線時以規則粗評（`fallback: true`）並附示範回答大綱。
