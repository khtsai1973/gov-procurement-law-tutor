/**
 * 單元教材來源／審核狀態（AI 產生須教師審核後才可發布）。
 */

export const MATERIAL_SOURCES = ["MANUAL", "AI"] as const;
export type MaterialSource = (typeof MATERIAL_SOURCES)[number];

export const MATERIAL_REVIEW_STATUSES = ["NONE", "PENDING_REVIEW", "APPROVED"] as const;
export type MaterialReviewStatus = (typeof MATERIAL_REVIEW_STATUSES)[number];

export function isMaterialSource(v: string): v is MaterialSource {
  return (MATERIAL_SOURCES as readonly string[]).includes(v);
}

export function isMaterialReviewStatus(v: string): v is MaterialReviewStatus {
  return (MATERIAL_REVIEW_STATUSES as readonly string[]).includes(v);
}

export type MaterialReviewFields = {
  source?: string | null;
  reviewStatus?: string | null;
  published?: boolean | null;
};

/** AI 教材僅在審核完成（APPROVED）後可發布；手寫教材可直接發布 */
export function canPublishMaterial(m: MaterialReviewFields): boolean {
  const source = m.source === "AI" ? "AI" : "MANUAL";
  if (source !== "AI") return true;
  return m.reviewStatus === "APPROVED";
}

export function materialPublishBlockReason(m: MaterialReviewFields): string | null {
  if (canPublishMaterial(m)) return null;
  return "AI 產生之教材須先完成教師審核（顯示「審核完成」）後才能發布";
}

/** 列表／表單狀態文案 */
export function materialStatusLabel(m: MaterialReviewFields): string {
  const source = m.source === "AI" ? "AI" : "MANUAL";
  const reviewed = m.reviewStatus === "APPROVED";
  if (m.published) {
    if (source === "AI" && reviewed) return "審核完成・已發布";
    return "已發布";
  }
  if (source === "AI") {
    if (reviewed) return "審核完成";
    return "待審核";
  }
  return "草稿";
}

export function materialStatusTone(
  m: MaterialReviewFields,
): "emerald" | "sky" | "amber" | "slate" {
  const label = materialStatusLabel(m);
  if (label.includes("已發布")) return "emerald";
  if (label === "審核完成") return "sky";
  if (label === "待審核") return "amber";
  return "slate";
}
