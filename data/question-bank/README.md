# 題庫（Question Bank）

常見提問與關鍵詞，匯入 PostgreSQL 後供 RAG **查詢擴展**與**相關法規 slug 加權**。`hintAnswer` 僅為檢索／回答導引，**不是**法條原文；實際回答仍須以知識庫內法規片段為準。

## 內建題目

- `starter.json`：約 20 題，涵蓋金額門檻、議價比減、未達公告金額、最有利標、招標期限等主題。

## 新增或修改題目

1. 在 `data/question-bank/` 新增或編輯 JSON 檔（可複製 `starter.json` 結構）。
2. 每筆題目建議欄位：

| 欄位 | 必填 | 說明 |
|------|------|------|
| `key` | 是 | 穩定識別碼（英文 kebab-case），匯入時 upsert 用 |
| `question` | 是 | 代表性問法（繁體中文） |
| `keywords` | 是 | 使用者可能出現的關鍵詞，用於比對查詢 |
| `relatedSlugs` | 是 | 對應 `Regulation.slug`，RAG 檢索時加權 |
| `category` | 是 | 分類標籤（如 `金額門檻`） |
| `hintAnswer` | 否 | 給模型的簡短導引，勿寫死具體法條數字或條文全文 |

3. `relatedSlugs` 須與 `prisma/seed.ts` 內已 seed 的法規 `slug` 一致（例如 `government-procurement-act`、`pcc-procurement-amount-thresholds`）。

範例：

```json
{
  "key": "my-custom-question",
  "category": "金額門檻",
  "question": "複數決標的採購金額怎麼算？",
  "keywords": ["複數決標", "採購金額", "分項"],
  "relatedSlugs": ["government-procurement-act", "gpa-enforcement-rules"],
  "hintAnswer": "請依使用者描述之分項標的，檢索採購法關於採購金額與複數決標之條文。"
}
```

## 從 PDF 匯入（政府採購法規全部題庫）

將 `政府採購法規全部題庫.pdf` 放在專案根目錄，執行：

```powershell
npm install
npm run corpus:question-bank-from-pdf
```

會產生 `gpa-full-question-bank.json` 並寫入資料庫。亦可一次執行：

```powershell
.\scripts\run-question-bank-from-pdf.ps1
```

若 PDF 為掃描影像、擷取文字過短，請在本機執行：

```powershell
pdftotext -enc UTF-8 "政府採購法規全部題庫.pdf" data\question-bank\gpa-full.txt
npm run corpus:parse-question-bank-text -- --text data/question-bank/gpa-full.txt
npm run corpus:import-question-bank
```

## 匯入

```powershell
npm run db:push          # 首次需套用 QuestionBankItem 資料表
npm run corpus:import-question-bank
```

`db:seed` 預設會一併匯入題庫。若只要 seed 法規、不要題庫：

```powershell
$env:SKIP_QUESTION_BANK_IMPORT = "1"
npm run db:seed
```

## 檔案格式

根目錄下每個 `*.json` 皆可匯入，格式：

```json
{
  "version": 1,
  "items": [ /* QuestionBankItem 物件陣列 */ ]
}
```
