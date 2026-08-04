# 混合診斷：Deterministic + Generative

## 架構

| 層 | 元件 | 職責 |
|----|------|------|
| **標籤化** | `knowledge-tags.ts` | 受控知識軸（10 類）＋自 category／keywords／slug／顯式 `knowledgeTags` 推導 |
| **確定性** | `knowledge-radar.ts` | 依錯題／正答標籤計算雷達正確率、弱點／強項標籤（不經 LLM） |
| **生成式** | `exam-diagnostics.ts` | 以弱點標籤＋錯題＋RAG 片段，請 LLM 產出語意化建議與補強指引 |

雷達數值寫入 `MockExamSession.diagnosticRadar`；AI 全文寫入 `diagnosticSummary`。

## 知識軸

招標程序、決標與評選、金額門檻、廠商資格、履約驗收、爭議處理、罰則倫理、採購契約、電子採購、錯誤態樣。

## 使用

1. 交卷後摘要頁／單次測驗頁顯示雷達圖。
2. 「開始診斷」呼叫 `POST /api/mock-exam/diagnose`（亦可 autoStart）。
3. 題庫匯入時自動寫入推導後的 `knowledgeTags`；JSON 亦可選填顯式標籤。

## 升級

`ensureDiagnosticsSchema()` 會幂等補齊欄位；正式區無需先手動 `db:push` 也可運作（建議仍執行 push／重匯題庫以持久化 tags）。
