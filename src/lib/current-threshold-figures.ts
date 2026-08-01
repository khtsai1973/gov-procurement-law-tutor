/**
 * 「查核金額／公告金額各是多少」類問題的確定性回答。
 * 數字與 data/corpus/pcc-procurement-amount-thresholds.md、AMOUNT_THRESHOLDS 一致。
 */

import { isAmountTierClassificationQuery, parseAmountTwd } from "@/lib/amount-tier";

/** 是否為詢問現行查核／公告金額數字（非「給定金額問級距」） */
export function isCurrentThresholdFiguresQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;

  // 已給出本案金額並問級距者，走級距判定，不走本模組
  if (isAmountTierClassificationQuery(q) && parseAmountTwd(q) != null) {
    return false;
  }

  const hasAudit = /查核金額/.test(q);
  const hasAnnounce = /公告金額/.test(q);
  if (!hasAudit || !hasAnnounce) return false;

  // 需明確在問「數字／多少」，避免命中「查核與公告有何差別」等概念題
  const asksFigures =
    /多少|幾元|各是|是多少|為多少|數字|現行|今年|目前|本年度/.test(q);

  return asksFigures;
}

/** 確定性回答（與工程會門檻彙整一致） */
export function buildCurrentThresholdFiguresAnswer(): string {
  return [
    "結論：現行政府採購法的查核金額為工程及財物採購新臺幣 5,000 萬元、勞務採購新臺幣 1,000 萬元；公告金額則一律為新臺幣 150 萬元。",
    "",
    "說明：",
    "1. 查核金額（新臺幣）：工程 5,000 萬元、財物 5,000 萬元、勞務 1,000 萬元。",
    "2. 公告金額（新臺幣）：工程、財物、勞務一律為 150 萬元。",
    "3. 法源：政府採購法第 12 條第 3 項（查核金額）、第 13 條第 3 項（公告金額）；具體數額由主管機關（工程會）以公告定之。",
    "4. 實際適用仍以工程會最新公告為準。",
    "",
    "資料來源：工程會採購金額門檻（函釋／公告彙整）。",
  ].join("\n");
}
