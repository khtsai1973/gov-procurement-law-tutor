/**
 * 教材資訊欄位（法規版本／產生日期／審核／最後修正）
 * 供教師端、學員端與匯出文件共用。
 */

import {
  DEFAULT_REGULATION_VERSION,
  formatMaterialDate,
} from "@/lib/material-review";

export type MaterialInfoSource = {
  source?: string | null;
  createdAt?: Date | string | null;
  aiGeneratedAt?: Date | string | null;
  reviewedAt?: Date | string | null;
  regulationVersion?: string | null;
  lastRevisionAt?: Date | string | null;
  lastRevisionNote?: string | null;
  reviewerName?: string | null;
  lastRevisionByName?: string | null;
};

export type MaterialInfoFields = {
  regulationVersion: string;
  generatedAt: string;
  reviewedAt: string;
  reviewer: string;
  lastRevision: string;
};

/** 產生日期：AI 用 aiGeneratedAt，否則用建立時間 */
export function materialGeneratedAt(
  m: Pick<MaterialInfoSource, "aiGeneratedAt" | "createdAt">,
): Date | string | null {
  return m.aiGeneratedAt ?? m.createdAt ?? null;
}

export function formatLastRevisionRecord(
  m: Pick<
    MaterialInfoSource,
    "lastRevisionAt" | "lastRevisionNote" | "lastRevisionByName"
  >,
): string {
  const at = formatMaterialDate(m.lastRevisionAt);
  if (at === "—") return "—";
  const parts = [at];
  const by = m.lastRevisionByName?.trim();
  if (by) parts.push(by);
  const note = m.lastRevisionNote?.trim();
  if (note) parts.push(note);
  return parts.join(" · ");
}

/** 組出五項資訊欄位（顯示用字串） */
export function buildMaterialInfoFields(m: MaterialInfoSource): MaterialInfoFields {
  return {
    regulationVersion: m.regulationVersion?.trim() || DEFAULT_REGULATION_VERSION,
    generatedAt: formatMaterialDate(materialGeneratedAt(m)),
    reviewedAt: formatMaterialDate(m.reviewedAt),
    reviewer: m.reviewerName?.trim() || "—",
    lastRevision: formatLastRevisionRecord(m),
  };
}

/** 匯出文件／簡報用的資訊列文字 */
export function materialInfoExportLines(info: MaterialInfoFields): string[] {
  return [
    `法規版本：${info.regulationVersion}`,
    `產生日期：${info.generatedAt}`,
    `教師審核日期：${info.reviewedAt}`,
    `審核人員：${info.reviewer}`,
    `最後修正紀錄：${info.lastRevision}`,
  ];
}
