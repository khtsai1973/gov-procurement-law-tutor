# 引導式 Prompt：動態欄位填寫（Dynamic Slot-Filling）

## 問題

僅帶入固定填空模板時，使用者常略過關鍵欄位（標的、金額級距），導致回答品質受限。

## 做法

1. 點擊預設情境 → 彈出輕量表單（`GuidedSlotForm`）
2. 必填欄位：採購標的、預算金額（萬元）／級距、招標／決標方式等（依情境而異）
3. 可點選「提示詞範例」填入「想請教」
4. 「組裝並帶入問題框」→ `assembleGuidedPrompt` 產出結構化 Prompt

## 範例輸出

```text
【金額門檻／級距｜結構化案情】
採購標的：資訊服務（屬勞務）
預算或估計採購金額：新臺幣 2,500,000 元（約 250 萬元）
是否含後續擴充或選購：否
想確認：屬於哪一個採購金額級距（…）

想請教：
屬哪一級距？
```

## 程式

| 檔案 | 職責 |
|------|------|
| `src/lib/guided-prompts.ts` | 情境、slots、組裝／驗證 |
| `src/components/GuidedSlotForm.tsx` | 輕量表單 UI |
| `src/components/ChatPanel.tsx` | 點擊情境開啟表單 |
