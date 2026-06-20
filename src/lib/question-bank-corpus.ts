import type { PrismaClient, QuestionBankItem } from "@prisma/client";
import { RegulationTier } from "@prisma/client";

/** 題庫在法規清單中的 slug 前綴 */
export const QUESTION_BANK_SLUG_PREFIX = "qb-";

export function categoryToQuestionBankSlug(category: string): string {
  const normalized = category
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${QUESTION_BANK_SLUG_PREFIX}${normalized || "general"}`;
}

export function isQuestionBankSlug(slug: string): boolean {
  return slug.startsWith(QUESTION_BANK_SLUG_PREFIX);
}

function groupByCategory(items: QuestionBankItem[]): Map<string, QuestionBankItem[]> {
  const map = new Map<string, QuestionBankItem[]>();
  for (const item of items) {
    const category = item.category.trim() || "題庫";
    const list = map.get(category) ?? [];
    list.push(item);
    map.set(category, list);
  }
  return map;
}

/** 將題庫分類轉成可檢索的 Markdown 全文 */
export function buildQuestionBankMarkdown(category: string, items: QuestionBankItem[]): string {
  const lines: string[] = [
    `# 題庫｜${category}`,
    "",
    "> 本段為政府採購法規題庫整理，供 RAG 檢索與學習參考；**非**法規／函釋原文，正式作答仍須引用法規片段。",
    "",
    `共 ${items.length} 題。`,
    "",
  ];

  for (const item of items) {
    lines.push(`## ${item.question}`);
    lines.push("");
    if (item.keywords.length > 0) {
      lines.push(`- 關鍵詞：${item.keywords.join("、")}`);
    }
    if (item.relatedSlugs.length > 0) {
      lines.push(`- 對應法規 slug：${item.relatedSlugs.join("、")}`);
    }
    if (item.hintAnswer?.trim()) {
      lines.push(`- 導引：${item.hintAnswer.trim()}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * 將 QuestionBankItem 同步為 Regulation（位階：題庫），供清單顯示與 RAG ingest。
 */
export async function syncQuestionBankRegulations(
  prisma: PrismaClient,
): Promise<{ categories: number; items: number; slugs: string[] }> {
  const items = await prisma.questionBankItem.findMany({ orderBy: { key: "asc" } });
  const grouped = groupByCategory(items);
  const slugs: string[] = [];
  let sortOrder = 0;

  for (const [category, categoryItems] of [...grouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "zh-Hant"),
  )) {
    const slug = categoryToQuestionBankSlug(category);
    slugs.push(slug);
    await prisma.regulation.upsert({
      where: { slug },
      create: {
        slug,
        title: `題庫｜${category}`,
        tier: RegulationTier.QUESTION_BANK,
        sortOrder: sortOrder++,
        notes: `共 ${categoryItems.length} 題；供檢索參考，非條文原文。`,
        sourceUrl: null,
        lastModifiedAt: new Date(),
      },
      update: {
        title: `題庫｜${category}`,
        tier: RegulationTier.QUESTION_BANK,
        sortOrder: sortOrder - 1,
        notes: `共 ${categoryItems.length} 題；供檢索參考，非條文原文。`,
        lastModifiedAt: new Date(),
      },
    });
  }

  // 移除已不存在的題庫分類
  const stale = await prisma.regulation.findMany({
    where: {
      tier: RegulationTier.QUESTION_BANK,
      slug: { notIn: slugs.length > 0 ? slugs : ["__none__"] },
    },
    select: { id: true },
  });
  if (stale.length > 0) {
    await prisma.regulation.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } },
    });
  }

  return { categories: grouped.size, items: items.length, slugs };
}

export async function loadQuestionBankMarkdownForRegulation(
  prisma: PrismaClient,
  slug: string,
  title: string,
): Promise<string | null> {
  if (!isQuestionBankSlug(slug)) return null;

  const category = title.replace(/^題庫｜/, "").trim() || "題庫";
  const items = await prisma.questionBankItem.findMany({
    where: { category },
    orderBy: { key: "asc" },
  });
  if (items.length === 0) return null;
  return buildQuestionBankMarkdown(category, items);
}
