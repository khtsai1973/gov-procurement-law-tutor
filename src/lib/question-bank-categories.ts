/** 正式題庫分類（僅此 14 類） */
export const OFFICIAL_QUESTION_BANK_CATEGORIES = [
  "政府採購全生命週期概論",
  "政府採購法之總則、招標及決標",
  "政府採購法之履約管理及驗收",
  "政府採購法之罰則及附則",
  "政府採購法之爭議處理",
  "底價及價格分析",
  "投標須知及招標文件製作",
  "採購契約",
  "最有利標及評選優勝廠商",
  "電子採購實務",
  "工程及技術服務採購作業",
  "財物及勞務採購作業",
  "錯誤採購態樣",
  "道德規範及違法處置",
] as const;

const OFFICIAL_CATEGORY_SET = new Set<string>(OFFICIAL_QUESTION_BANK_CATEGORIES);

const CATEGORY_ALIASES: Record<string, string> = {
  最有利標: "最有利標及評選優勝廠商",
  採購人員倫理: "道德規範及違法處置",
  金額門檻: "政府採購法之總則、招標及決標",
  未達公告金額: "政府採購法之總則、招標及決標",
  招標期限: "投標須知及招標文件製作",
  議價比減: "政府採購法之總則、招標及決標",
};

export function categoryForArticleNumber(articleNo: number): string {
  if (articleNo >= 63 && articleNo <= 73) return "政府採購法之履約管理及驗收";
  if (articleNo >= 74 && articleNo <= 86) return "政府採購法之爭議處理";
  if (articleNo >= 87) return "政府採購法之罰則及附則";
  return "政府採購法之總則、招標及決標";
}

/** 正規化為正式 14 類；無法對應則回傳 null */
export function normalizeToOfficialCategory(raw: string): string | null {
  const base = (raw.split("｜")[0] ?? raw).trim();
  if (!base || base === "題庫") return null;
  if (OFFICIAL_CATEGORY_SET.has(base)) return base;
  if (CATEGORY_ALIASES[base]) return CATEGORY_ALIASES[base]!;
  const art = base.match(/^第\s*(\d{1,3})\s*條$/);
  if (art) return categoryForArticleNumber(Number.parseInt(art[1]!, 10));
  return null;
}

export function coerceOfficialCategory(raw: string): string {
  return normalizeToOfficialCategory(raw) ?? "政府採購全生命週期概論";
}
