/**
 * 單元教材審核工作流（法律型教材：AI 產生不可直接發布）。
 *
 * 顯示狀態：草稿｜待審｜已核准｜已發布｜退回修正
 */

export const MATERIAL_SOURCES = ["MANUAL", "AI"] as const;
export type MaterialSource = (typeof MATERIAL_SOURCES)[number];

/** DB reviewStatus（NONE 視為 DRAFT 相容舊資料） */
export const MATERIAL_REVIEW_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "RETURNED",
  "NONE", // legacy → 草稿
] as const;
export type MaterialReviewStatus = (typeof MATERIAL_REVIEW_STATUSES)[number];

export type MaterialRevisionEntry = {
  at: string;
  byId: string;
  byName: string;
  note: string;
  fromStatus: string;
  toStatus: string;
};

export type MaterialReviewFields = {
  source?: string | null;
  reviewStatus?: string | null;
  published?: boolean | null;
};

export function normalizeReviewStatus(raw: string | null | undefined): Exclude<
  MaterialReviewStatus,
  "NONE"
> {
  if (raw === "PENDING_REVIEW") return "PENDING_REVIEW";
  if (raw === "APPROVED") return "APPROVED";
  if (raw === "RETURNED") return "RETURNED";
  return "DRAFT";
}

export function isMaterialSource(v: string): v is MaterialSource {
  return (MATERIAL_SOURCES as readonly string[]).includes(v);
}

/** AI 教材僅「已核准」後可發布；手寫可自草稿／已核准發布 */
export function canPublishMaterial(m: MaterialReviewFields): boolean {
  const source = m.source === "AI" ? "AI" : "MANUAL";
  const status = normalizeReviewStatus(m.reviewStatus);
  if (source === "AI") return status === "APPROVED";
  return status === "DRAFT" || status === "APPROVED";
}

export function materialPublishBlockReason(m: MaterialReviewFields): string | null {
  if (canPublishMaterial(m)) return null;
  const status = normalizeReviewStatus(m.reviewStatus);
  if (status === "PENDING_REVIEW") return "教材尚在「待審」，請先核准後再發布";
  if (status === "RETURNED") return "教材為「退回修正」，請修正並重新送審／核准後再發布";
  return "AI 產生之教材須先「已核准」後才能發布";
}

/**
 * 前台／列表狀態文案（五態）
 * 已發布優先於審核狀態顯示。
 */
export function materialStatusLabel(m: MaterialReviewFields): string {
  if (m.published) return "已發布";
  switch (normalizeReviewStatus(m.reviewStatus)) {
    case "PENDING_REVIEW":
      return "待審";
    case "APPROVED":
      return "已核准";
    case "RETURNED":
      return "退回修正";
    default:
      return "草稿";
  }
}

export function materialStatusTone(
  m: MaterialReviewFields,
): "emerald" | "sky" | "amber" | "rose" | "slate" {
  const label = materialStatusLabel(m);
  if (label === "已發布") return "emerald";
  if (label === "已核准") return "sky";
  if (label === "待審") return "amber";
  if (label === "退回修正") return "rose";
  return "slate";
}

/** 草稿／退回修正 → 可送審 */
export function canSubmitForReview(m: MaterialReviewFields): boolean {
  if (m.published) return false;
  const status = normalizeReviewStatus(m.reviewStatus);
  return status === "DRAFT" || status === "RETURNED";
}

/** 待審（或草稿／退回）→ 可核准；已發布不可 */
export function canApproveMaterial(m: MaterialReviewFields): boolean {
  if (m.published) return false;
  const status = normalizeReviewStatus(m.reviewStatus);
  return status === "PENDING_REVIEW" || status === "DRAFT" || status === "RETURNED";
}

/** 待審／已核准 → 可退回修正 */
export function canReturnMaterial(m: MaterialReviewFields): boolean {
  const status = normalizeReviewStatus(m.reviewStatus);
  return status === "PENDING_REVIEW" || status === "APPROVED";
}

export const DEFAULT_REGULATION_VERSION =
  "依知識庫現行法規／函釋（請教師核對最新修正）";

export function parseRevisionLog(raw: string | null | undefined): MaterialRevisionEntry[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object")
      .map((x) => {
        const row = x as Record<string, unknown>;
        return {
          at: String(row.at ?? ""),
          byId: String(row.byId ?? ""),
          byName: String(row.byName ?? "教師"),
          note: String(row.note ?? ""),
          fromStatus: String(row.fromStatus ?? ""),
          toStatus: String(row.toStatus ?? ""),
        };
      })
      .filter((x) => x.at);
  } catch {
    return [];
  }
}

export function appendRevisionLog(
  raw: string | null | undefined,
  entry: MaterialRevisionEntry,
  limit = 30,
): string {
  const list = parseRevisionLog(raw);
  list.unshift(entry);
  return JSON.stringify(list.slice(0, limit));
}

export function formatMaterialDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
