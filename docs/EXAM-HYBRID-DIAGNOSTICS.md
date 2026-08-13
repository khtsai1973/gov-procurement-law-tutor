# 混合診斷：Deterministic + Generative

## 架構

| 層 | 元件 | 職責 |
|----|------|------|
| **標籤化** | `knowledge-tags.ts` + `concept-tags.ts` | 知識軸（10 類）∪ 條次款項（例：第22條第1項第7款）∪ 概念詞（限制性招標、金額門檻…） |
| **確定性** | `knowledge-radar.ts` | 能力矩陣：依知識軸計算正確率；核心強項 ≥ 85%、關鍵弱點 &lt; 60% |
| **生成式（整場・階段2）** | `exam-diagnostics.ts` + `personal-weakness-report.ts` | 錯題標籤送入 LLM 知識圖譜分析 → 《個人化學習弱點診斷書》 |
| **生成式（單題・階段1）** | `question-wrong-reason.ts` | 答錯選擇題時：認知誤區＋正確／錯誤選項適用條件差異（2 句） |
| **申論批改（階段3）** | `scenario-essay-grade.ts` | 開放式採購情境題 + Rubric（30／40／30）JSON 批改 |

雷達數值寫入 `MockExamSession.diagnosticRadar`；AI 全文寫入 `diagnosticSummary`；法規＋練習題寫入 `diagnosticRecommendations`（bundle JSON）。

## 階段 2：能力矩陣與個人化弱點儀表板

測驗結束後：

1. 規則引擎依本場作答產出**能力矩陣**（雷達圖）。
2. 彙整錯題完整標籤（軸＋條次＋概念）送入 LLM。
3. 產出《個人化學習弱點診斷書》：

| 區塊 | 內容 |
|------|------|
| **核心強項** | 正確率 ≥ 85% 的主題（例：招標公告時程、押標金退還規定） |
| **關鍵弱點** | 正確率偏低之軸／概念（例：異議與申訴期限計算 30%） |
| **行動建議** | 恰好 **3** 條補強法規連結＋**2** 道精準推薦練習題 |

API：`POST /api/mock-exam/diagnose`（回傳 `personalReport`、`practiceQuestions`、`recommendations`、`radar`）。

UI：`ExamDiagnosticsPanel`（模考結果／單次測驗頁）。

## 階段 1：錯題 AI 動態診斷

當模擬考試或題庫練習**答錯**時，在固定解析之外自動（或手動）呼叫：

> 使用者選擇了 [錯誤選項]，但標準答案為 [正確選項]。請分析選擇錯誤選項的常見認知誤區，並用 2 句話說明兩者在採購法適用條件上的核心差異。

- API：`POST /api/question-bank/diagnose-wrong`
- UI：`WrongAnswerLlmDiagnosis`（模考揭示後自動；題庫練習「送出並診斷」）

輸出區塊：`## 認知誤區`／`## 適用條件差異`／`## 弱點提示`

## 階段 3：採購實務情境申論題 AI 批改（Rubric-Based）

開放式情境題（例：勞務履約逾期 10 日，依第 63 條及契約如何處置）。

| Rubric | 權重 |
|--------|------|
| 法條引用正確性 | 30% |
| 處置程序合法性 | 40% |
| 邏輯連貫與公文用語 | 30% |

- System Prompt：`SCENARIO_ESSAY_GRADING_SYSTEM`（嚴格規準）
- Output：JSON（`scores`／`total`／`deductions`／`strengths`／`modelAnswer`）
- API：`POST /api/scenario-essay/grade`；題目列表 `GET /api/scenario-essay/questions`
- UI：`/scenario-essay`（`ScenarioEssayPanel`）
- 題庫：`src/lib/scenario-essay-bank.ts`（內建 4 題，含第 63 條逾期情境）

## 知識軸

招標程序、決標與評選、金額門檻、廠商資格、履約驗收、爭議處理、罰則倫理、採購契約、電子採購、錯誤態樣。

## 使用

1. 交卷後摘要頁／單次測驗頁顯示能力矩陣與診斷書。
2. 「開始分析」呼叫 `POST /api/mock-exam/diagnose`（亦可 autoStart）。
3. 單題答錯時自動顯示「AI 動態錯題診斷」。
4. 題庫匯入時自動寫入 `resolveAllQuestionTags`（軸＋概念＋條次）；JSON 亦可選填顯式標籤。

## 升級

`ensureDiagnosticsSchema()` 會幂等補齊欄位；正式區無需先手動 `db:push` 也可運作（建議仍執行 push／重匯題庫以持久化 tags）。
