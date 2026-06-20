import { RegulationTier } from "@prisma/client";

/** 位階排序：數字越小位階越高 */
const TIER_RANK: Record<RegulationTier, number> = {
  [RegulationTier.LAW]: 0,
  [RegulationTier.REGULATION]: 1,
  [RegulationTier.ADMIN_RULE]: 2,
  [RegulationTier.INTERPRETATION]: 3,
  [RegulationTier.QUESTION_BANK]: 4,
};

const TIER_LABEL: Record<RegulationTier, string> = {
  [RegulationTier.LAW]: "法律",
  [RegulationTier.REGULATION]: "法規命令",
  [RegulationTier.ADMIN_RULE]: "行政規則／要點",
  [RegulationTier.INTERPRETATION]: "函釋／解釋令函",
  [RegulationTier.QUESTION_BANK]: "題庫",
};

export function tierSortKey(tier: RegulationTier, sortOrder: number): number {
  return TIER_RANK[tier] * 1_000_000 + sortOrder;
}

export function tierLabel(tier: RegulationTier): string {
  return TIER_LABEL[tier];
}
