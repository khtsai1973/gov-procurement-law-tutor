import starter from "../../data/question-bank/starter.json";

export type PromptSuggestion = {
  key: string;
  category: string;
  question: string;
};

const CATEGORY_ORDER = [
  "金額門檻",
  "未達公告金額",
  "招標期限",
  "最有利標",
  "議價比減",
] as const;

export const PROMPT_TIP =
  "提問小提示：請盡量包含採購標的（工程／財物／勞務或資訊服務等）、採購金額、程序階段，以及招標或決標方式。詢問金額級距時可直接寫「○○萬元○○採購屬哪一級距」。本站會整合法規／函釋片段分析作答；與政府採購法規無關之問題將回覆「非本主題的範圍」。";

export function getPromptSuggestionsByCategory(): {
  category: string;
  items: PromptSuggestion[];
}[] {
  const byCategory = new Map<string, PromptSuggestion[]>();

  for (const item of starter.items) {
    const list = byCategory.get(item.category) ?? [];
    list.push({
      key: item.key,
      category: item.category,
      question: item.question,
    });
    byCategory.set(item.category, list);
  }

  const ordered: { category: string; items: PromptSuggestion[] }[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = byCategory.get(category);
    if (items?.length) ordered.push({ category, items });
  }
  for (const [category, items] of byCategory) {
    if (!CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number])) {
      ordered.push({ category, items });
    }
  }
  return ordered;
}
