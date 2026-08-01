/**
 * 「小額採購金額門檻是多少」類問題的確定性回答。
 * 數字與 data/corpus/pcc-procurement-amount-thresholds.md、AMOUNT_THRESHOLDS 一致。
 */

import { isAmountTierClassificationQuery, parseAmountTwd } from "@/lib/amount-tier";

/** 是否為詢問小額採購金額門檻數字 */
export function isSmallPurchaseThresholdQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;

  if (isAmountTierClassificationQuery(q) && parseAmountTwd(q) != null) {
    return false;
  }

  if (!/小額採購|小額/.test(q)) return false;

  // 概念比較題（是否相同／差別）不走本模組
  if (/一樣|相同|差別|差異|不同|是不是|是否等同/.test(q) && !/多少|幾元|是多少|為多少/.test(q)) {
    return false;
  }

  return /多少|幾元|是多少|為多少|門檻|數字|現行|目前/.test(q);
}

/** 確定性回答（中央機關；與工程會門檻彙整一致） */
export function buildSmallPurchaseThresholdAnswer(): string {
  return [
    "結論：台灣中央機關的小額採購金額門檻為新臺幣 15 萬元以下（即公告金額 150 萬元的十分之一以下）。",
    "",
    "說明：",
    "1. 中央機關小額採購金額由主管機關（工程會）定之，現行為新臺幣 15 萬元以下（工程、財物、勞務皆同）。",
    "2. 公告金額為新臺幣 150 萬元，小額採購門檻相當於公告金額十分之一以下。",
    "3. 法源：政府採購法第 47 條第 3 項；地方機關小額採購金額由直轄市或縣（市）政府定之，均不得逾公告金額十分之一，地方未定者比照中央。",
    "4. 實際適用仍以工程會／地方政府最新公告為準。",
    "",
    "資料來源：工程會採購金額門檻（函釋／公告彙整）。",
  ].join("\n");
}
