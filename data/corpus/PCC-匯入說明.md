# 工程會要點手動匯入說明

工程會（採購資訊網）之行政規則／要點**不在**全國法規資料庫 API，需自行整理成 Markdown 放入本目錄。

## 一、檔名規則（必須完全一致）

路徑：`data/corpus/<slug>.md`

| 檔名（slug） | 法規／要點名稱 |
|-------------|----------------|
| `common-supply-contract-points.md` | 中央機關共同供應契約集中採購實施要點 |
| `public-works-public-inspection-points.md` | 公共工程招標文件公開閱覽制度實施要點 |
| `procurement-contract-essentials.md` | 採購契約要項 |
| `procurement-error-patterns.md` | 各類型採購錯誤行為態樣 |
| `mep-combined-separate-bidding.md` | 水管、電氣與建築工程合併或分開招標原則 |
| `international-competition-guidelines.md` | 機關辦理公共工程國際競圖注意事項 |
| `mega-procurement-reporting-rules.md` | 機關提報巨額採購使用情形及效益分析作業規定 |
| `turnkey-procurement-notice.md` | 統包作業須知 |
| `review-committee-panel-points.md` | 各機關採購評選委員會專家學者參考名單資料庫審議小組設置要點 |
| `expert-roster-db-points.md` | 各機關採購評選委員會專家學者參考名單資料庫建置及除名作業要點 |
| `most-advantageous-tender-operations-manual.md` | 最有利標作業手冊 |

## 二、內容從哪裡取得

1. 開啟 [政府電子採購網](https://www.pcc.gov.tw/)
2. 找「法規／要點／範本」或站內搜尋上表名稱
3. 複製**現行有效**全文（含章節、條次）
4. 貼入對應 `.md` 檔，略為排版即可（見下方格式建議）

### 最有利標作業手冊（`most-advantageous-tender-operations-manual.md`）

1. 開啟 [採購手冊及範例](https://www.pcc.gov.tw/content/list?eid=4581) → 「採購手冊及範例」或站內搜尋「最有利標作業手冊」
2. 下載**現行** PDF（例：113.12.16 工程企字第1130100580號函修正版；勿與僅含範例之「機關辦理最有利標簽辦文件範例」頁混淆）
3. 將 PDF 全文轉為文字，以 `##` 區分「壹、貳、…」大章、`###` 區分「一、二、…」小節（手冊無條次格式，勿強改為第 N 條）
4. 覆寫 `data/corpus/most-advantageous-tender-operations-manual.md` 中「待匯入」段落以下內容
5. 或將 PDF 轉為 `data/moj-cache/manual-pdf-extract.txt` 後執行 `node scripts/build-manual-corpus.mjs`
6. 一鍵（含評選辦法刷新、seed、ingest）：`node scripts/import-mat-manual.mjs` 或 `.\scripts\run-import-mat.ps1`
7. 執行 `npm run corpus:ingest`（若未用 import 腳本）

**與 MOJ 法規之區別**：`most-advantageous-tender-selection-rules`（最有利標**評選辦法**，pcode `A0030080`）由 `npm run corpus:fetch-github` 自動更新；本作業手冊為工程會實務指引，位階為 `ADMIN_RULE`。

## 三、Markdown 格式建議

- 第一行：`# 法規完整名稱`
- 可加來源連結、修正／發布日期
- 條文用 `## 章節名` / `### 第 N 條` 分段，方便檢索
- 純文字即可，無需特殊語法
- 編碼：**UTF-8**

可複製範本：`data/corpus/_範本-工程會要點.md`

## 四、寫入後載入知識庫

在專案目錄 PowerShell 執行：

```powershell
cd C:\Users\sport\gov-procurement-law-tutor
npm run corpus:ingest
```

或管理者登入後，在「管理者」頁按 **載入／更新知識庫**。

若同時要更新 MOJ 法規：

```powershell
npm run corpus:refresh
```

## 五、函釋

函釋亦可用相同方式：在資料庫新增一筆 `Regulation`（`tier: INTERPRETATION`）後，建立 `data/corpus/<新slug>.md`，再執行 `corpus:ingest`。

| 檔名（slug） | 名稱 |
|-------------|------|
| `pcc-procurement-amount-thresholds.md` | 工程會採購金額門檻（函釋／公告彙整） |
