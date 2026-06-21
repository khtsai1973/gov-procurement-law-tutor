# NotebookLM 匯入說明

將 **NotebookLM 筆記／來源摘要** 匯入本站 RAG 知識庫的流程（**非 API 即時同步**，而是匯出檔案 → 腳本匯入）。

## 1. 在 NotebookLM 整理內容

建議匯出或複製以下任一類型：

- 筆記本內的 **Notes（筆記）**
- 某份來源的 **摘要／重點整理**
- 你自行整理的 **法條對照、函釋整理**

## 2. 放入此資料夾

將文字存成 `.md` 或 `.txt`，例如：

```
data/notebooklm/採購法重點整理.md
data/notebooklm/評選委員會筆記.txt
```

### 方式 A：自動掃描（最簡單）

直接放檔案，腳本會依檔名建立 slug（前綴 `notebooklm-`）。

### 方式 B：使用 manifest.json（建議，可指定筆記本）

複製 `manifest.example.json` 為 `manifest.json` 並編輯：

```json
{
  "notebookTitle": "政府採購法研習筆記本",
  "notebookUrl": "https://notebooklm.google.com/",
  "sources": [
    {
      "file": "採購法重點整理.md",
      "title": "採購法重點整理（NotebookLM）",
      "tier": "INTERPRETATION",
      "relatedSlugs": ["government-procurement-act", "gpa-enforcement-rules"]
    }
  ]
}
```

### 方式 C：Markdown 前置 metadata（選填）

在檔案開頭加入 YAML frontmatter：

```markdown
---
title: 最有利標評選重點
slug: notebooklm-most-advantageous-notes
tier: INTERPRETATION
notebook: 政府採購法研習筆記本
notebookUrl: https://notebooklm.google.com/
relatedSlugs: most-advantageous-tender-selection-rules
---

（NotebookLM 匯出的正文…）
```

## 3. 執行匯入

```powershell
cd C:\Users\sport\gov-procurement-law-tutor

# 先預覽（不寫入）
npm run corpus:import-notebooklm -- --dry-run

# 正式匯入 + 更新 RAG
npm run corpus:import-notebooklm
```

### 常用參數

| 參數 | 說明 |
|------|------|
| `--dry-run` | 只預覽 slug，不寫入 DB / corpus |
| `--no-ingest` | 只寫入 corpus 與法規清單，不做 embedding |
| `--dir 路徑` | 自訂來源資料夾 |
| `--notebook 名稱` | 覆寫筆記本名稱 |
| `--notebook-url URL` | 筆記本連結（寫入 metadata） |

## 4. 匯入後會發生什麼

1. 在 `Regulation` 建立一筆法規／函釋項目（tier 預設 `INTERPRETATION`）
2. 正規化內容寫入 `data/corpus/{slug}.md`
3. 切 chunk + OpenAI embedding，供問答 RAG 檢索
4. 出現在「法規／函釋／題庫清單」頁面

## 5. 注意事項

- NotebookLM 內容為**輔助整理**，正式答案仍應以 MOJ 法規、工程會函釋為準
- 更新 NotebookLM 筆記後，覆蓋同名檔案再執行一次匯入即可
- 需要完整重建全部知識庫時：`npm run corpus:ingest`
