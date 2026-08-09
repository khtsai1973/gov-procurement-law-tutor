import { z } from "zod";

export const questionBankEntrySchema = z.object({
  key: z.string().min(1),
  question: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  relatedSlugs: z.array(z.string().min(1)),
  hintAnswer: z.string().optional(),
  category: z.string().min(1),
  /** 可選：顯式知識標籤（受控詞彙）；缺省時由規則自 category／keywords 推導 */
  knowledgeTags: z.array(z.string().min(1)).optional(),
  /** 高頻／重要題標記（至少應具備完整解析） */
  importance: z.enum(["high", "normal"]).optional(),
});

export const questionBankFileSchema = z.object({
  version: z.number().optional(),
  items: z.array(questionBankEntrySchema),
});

/** 僅覆寫既有題目的解析／重要度（不新增題目） */
export const questionBankExplanationOverlaySchema = z.object({
  version: z.number().optional(),
  kind: z.literal("explanations-overlay"),
  items: z.array(
    z.object({
      key: z.string().min(1),
      hintAnswer: z.string().min(1),
      importance: z.enum(["high", "normal"]).optional(),
    }),
  ),
});

export type QuestionBankEntry = z.infer<typeof questionBankEntrySchema>;
export type QuestionBankExplanationOverlay = z.infer<
  typeof questionBankExplanationOverlaySchema
>;

export type QuestionBankMatch = {
  keywords: string[];
  relatedSlugs: string[];
  hintAnswer?: string;
  matchedKeys: string[];
};

export const FULL_EXPLANATION_MARKER = "【完整解析】";

export function hasFullExplanation(hintAnswer: string | null | undefined): boolean {
  if (!hintAnswer?.trim()) return false;
  if (hintAnswer.includes(FULL_EXPLANATION_MARKER)) return true;
  // 僅「參考答案為…」短句不算完整解析
  const trimmed = hintAnswer.trim();
  if (/^【題庫】本題參考答案為/.test(trimmed) && trimmed.length < 120) return false;
  return trimmed.length >= 160;
}

export function isHighImportance(
  importance: string | null | undefined,
  hintAnswer?: string | null,
): boolean {
  if (importance === "high") return true;
  return hasFullExplanation(hintAnswer);
}
