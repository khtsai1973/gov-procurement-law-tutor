/**
 * 高頻／重要題完整解析覆寫：部署後即使尚未重匯題庫，揭示答案時也能讀到完整解析。
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import overlayBundled from "../../data/question-bank/high-priority-explanations.json";
import {
  FULL_EXPLANATION_MARKER,
  hasFullExplanation,
  questionBankExplanationOverlaySchema,
} from "@/lib/question-bank-types";

export type ExplanationOverlayItem = {
  hintAnswer: string;
  importance: "high" | "normal";
};

let cache: Map<string, ExplanationOverlayItem> | null = null;

function mapFromParsed(items: { key: string; hintAnswer: string; importance?: "high" | "normal" }[]) {
  const map = new Map<string, ExplanationOverlayItem>();
  for (const item of items) {
    map.set(item.key, {
      hintAnswer: item.hintAnswer.trim(),
      importance: item.importance ?? "high",
    });
  }
  return map;
}

function loadOverlayFromDisk(): Map<string, ExplanationOverlayItem> {
  const file = path.join(
    process.cwd(),
    "data",
    "question-bank",
    "high-priority-explanations.json",
  );
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
    const parsed = questionBankExplanationOverlaySchema.parse(raw);
    return mapFromParsed(parsed.items);
  } catch (e) {
    console.warn("[question-bank-explanations] disk overlay load failed:", e);
    return new Map();
  }
}

function loadOverlayBundled(): Map<string, ExplanationOverlayItem> {
  try {
    const parsed = questionBankExplanationOverlaySchema.parse(overlayBundled);
    return mapFromParsed(parsed.items);
  } catch (e) {
    console.warn("[question-bank-explanations] bundled overlay load failed:", e);
    return new Map();
  }
}

export function getExplanationOverlayMap(): Map<string, ExplanationOverlayItem> {
  if (cache) return cache;
  const fromDisk = loadOverlayFromDisk();
  cache = fromDisk.size > 0 ? fromDisk : loadOverlayBundled();
  return cache;
}

/** 測試用：清空快取 */
export function resetExplanationOverlayCache(): void {
  cache = null;
}

export function getExplanationOverlay(key: string): ExplanationOverlayItem | null {
  return getExplanationOverlayMap().get(key) ?? null;
}

/**
 * 合併 DB／題庫列與高頻解析覆寫。
 * 覆寫優先於短參考答案；若 DB 已有更長完整解析則保留 DB。
 */
export function resolveQuestionExplanation(item: {
  key: string;
  hintAnswer?: string | null;
  importance?: string | null;
}): {
  hintAnswer: string | null;
  importance: "high" | "normal";
  hasFullExplanation: boolean;
  fromOverlay: boolean;
} {
  const overlay = getExplanationOverlay(item.key);
  const dbHint = item.hintAnswer?.trim() || null;
  const dbImportance = item.importance === "high" ? "high" : "normal";

  if (!overlay) {
    return {
      hintAnswer: dbHint,
      importance: dbImportance,
      hasFullExplanation: hasFullExplanation(dbHint),
      fromOverlay: false,
    };
  }

  const preferOverlay =
    !dbHint ||
    (!hasFullExplanation(dbHint) && hasFullExplanation(overlay.hintAnswer)) ||
    (hasFullExplanation(overlay.hintAnswer) &&
      overlay.hintAnswer.length > (dbHint?.length ?? 0) + 40);

  const hintAnswer = preferOverlay ? overlay.hintAnswer : dbHint;
  const importance =
    overlay.importance === "high" || dbImportance === "high" ? "high" : "normal";

  return {
    hintAnswer,
    importance,
    hasFullExplanation: hasFullExplanation(hintAnswer),
    fromOverlay: preferOverlay,
  };
}

export function explanationDisplayLabel(hasFull: boolean): string {
  return hasFull ? "完整教學解析" : "解答提示";
}

export { FULL_EXPLANATION_MARKER, hasFullExplanation };
