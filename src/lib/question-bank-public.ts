/**
 * 題庫公開頁快取：分類統計、模考類別選項、分頁列表（不含個人化資料）。
 */

import { revalidateTag, unstable_cache } from "next/cache";

import { ensureQuestionBankSchema } from "@/lib/ensure-question-bank-schema";
import {
  buildMockExamCategoryOptions,
  type MockExamCategoryOption,
} from "@/lib/mock-exam";
import prisma from "@/lib/prisma";
import {
  explanationDisplayLabel,
  getExplanationOverlayMap,
  resolveQuestionExplanation,
} from "@/lib/question-bank-explanations";
import {
  QUESTION_BANK_PAGE_SIZE,
  parseQuestionBankListQuery,
  type QuestionBankExplanationPayload,
  type QuestionBankListItem,
  type QuestionBankListQuery,
  type QuestionBankListResult,
} from "@/lib/question-bank-list";

export const QUESTION_BANK_CACHE_TAG = "question-bank-public";
export const QUESTION_BANK_LIST_REVALIDATE_SEC = 60;
export {
  QUESTION_BANK_PAGE_SIZE,
  parseQuestionBankListQuery,
  type QuestionBankExplanationPayload,
  type QuestionBankListItem,
  type QuestionBankListQuery,
  type QuestionBankListResult,
};

export type QuestionBankCategoryStat = {
  category: string;
  count: number;
};

export type QuestionBankCategorySummary = {
  categories: string[];
  stats: QuestionBankCategoryStat[];
  totalCount: number;
};

function buildListWhere(
  query: QuestionBankListQuery,
  overlayKeys: string[],
  opts?: { includeImportance?: boolean },
) {
  const includeImportance = opts?.includeImportance !== false;
  const and: Record<string, unknown>[] = [];
  if (query.category) and.push({ category: query.category });
  if (query.important && includeImportance) {
    and.push({
      OR: [
        { importance: "high" },
        ...(overlayKeys.length ? [{ key: { in: overlayKeys } }] : []),
      ],
    });
  }
  if (query.q) {
    and.push({
      OR: [
        { question: { contains: query.q, mode: "insensitive" as const } },
        { key: { contains: query.q, mode: "insensitive" as const } },
        { keywords: { has: query.q } },
      ],
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

function toListItem(row: {
  id: string;
  key: string;
  question: string;
  category: string;
  keywords: string[];
  hintAnswer: string | null;
  importance?: string | null;
}): QuestionBankListItem {
  const resolved = resolveQuestionExplanation({
    key: row.key,
    hintAnswer: row.hintAnswer,
    importance: row.importance,
  });
  return {
    id: row.id,
    key: row.key,
    question: row.question,
    category: row.category,
    keywords: row.keywords,
    importance: resolved.importance,
    hasHint: Boolean(resolved.hintAnswer),
    hasFullExplanation: resolved.hasFullExplanation,
  };
}

async function queryCategorySummary(): Promise<QuestionBankCategorySummary> {
  const grouped = await prisma.questionBankItem.groupBy({
    by: ["category"],
    _count: { _all: true },
    orderBy: { category: "asc" },
  });
  const stats = grouped.map((g) => ({
    category: g.category,
    count: g._count._all,
  }));
  return {
    categories: stats.map((s) => s.category),
    stats,
    totalCount: stats.reduce((sum, s) => sum + s.count, 0),
  };
}

async function queryMockExamCategoryOptions(): Promise<MockExamCategoryOption[]> {
  const bankItems = await prisma.questionBankItem.findMany({
    select: { category: true, key: true, question: true },
  });
  return buildMockExamCategoryOptions(bankItems);
}

const getCachedCategorySummary = unstable_cache(
  async () => queryCategorySummary(),
  ["question-bank-category-summary-v1"],
  { revalidate: QUESTION_BANK_LIST_REVALIDATE_SEC, tags: [QUESTION_BANK_CACHE_TAG] },
);

const getCachedMockExamCategoryOptions = unstable_cache(
  async () => queryMockExamCategoryOptions(),
  ["mock-exam-category-options-v1"],
  { revalidate: QUESTION_BANK_LIST_REVALIDATE_SEC, tags: [QUESTION_BANK_CACHE_TAG] },
);

/** 分類統計（60s 快取）；失敗時補 schema 後直查 */
export async function loadQuestionBankCategorySummary(): Promise<QuestionBankCategorySummary> {
  try {
    return await getCachedCategorySummary();
  } catch (e) {
    console.error("[question-bank] category summary failed, ensuring schema:", e);
    try {
      await ensureQuestionBankSchema().catch(() => undefined);
      return await queryCategorySummary();
    } catch (e2) {
      console.error("[question-bank] category summary fallback failed:", e2);
      return { categories: [], stats: [], totalCount: 0 };
    }
  }
}

/** 模考類別選項（60s 快取） */
export async function loadMockExamCategoryOptions(): Promise<MockExamCategoryOption[]> {
  try {
    return await getCachedMockExamCategoryOptions();
  } catch (e) {
    console.error("[mock-exam] category options failed, ensuring schema:", e);
    try {
      await ensureQuestionBankSchema().catch(() => undefined);
      return await queryMockExamCategoryOptions();
    } catch (e2) {
      console.error("[mock-exam] category options fallback failed:", e2);
      return [];
    }
  }
}

const listSelect = {
  id: true,
  key: true,
  question: true,
  category: true,
  keywords: true,
  hintAnswer: true,
  importance: true,
} as const;

const listSelectFallback = {
  id: true,
  key: true,
  question: true,
  category: true,
  keywords: true,
  hintAnswer: true,
} as const;

async function queryQuestionBankPage(
  category: string,
  q: string,
  importantFlag: string,
  page: number,
): Promise<QuestionBankListResult> {
  const query = parseQuestionBankListQuery({
    category,
    q,
    important: importantFlag,
    page: String(page),
  });
  const overlayKeys = [...getExplanationOverlayMap().keys()];
  const where = buildListWhere(query, overlayKeys);
  const filteredCount = await prisma.questionBankItem.count({ where });
  const totalPages = Math.max(1, Math.ceil(filteredCount / QUESTION_BANK_PAGE_SIZE));
  const safePage = Math.min(query.page, totalPages);
  const rows = await prisma.questionBankItem.findMany({
    where,
    orderBy: [{ category: "asc" }, { key: "asc" }],
    skip: (safePage - 1) * QUESTION_BANK_PAGE_SIZE,
    take: QUESTION_BANK_PAGE_SIZE,
    select: listSelect,
  });
  return {
    items: rows.map(toListItem),
    filteredCount,
    totalPages,
    page: safePage,
  };
}

const getCachedQuestionBankPage = unstable_cache(
  async (category: string, q: string, importantFlag: string, page: number) =>
    queryQuestionBankPage(category, q, importantFlag, page),
  ["question-bank-page-v1"],
  { revalidate: QUESTION_BANK_LIST_REVALIDATE_SEC, tags: [QUESTION_BANK_CACHE_TAG] },
);

async function queryQuestionBankPageFallback(
  query: QuestionBankListQuery,
): Promise<QuestionBankListResult> {
  const overlayKeys = [...getExplanationOverlayMap().keys()];
  const where = buildListWhere(query, overlayKeys, { includeImportance: false });
  const filteredCount = await prisma.questionBankItem.count({ where });
  const totalPages = Math.max(1, Math.ceil(filteredCount / QUESTION_BANK_PAGE_SIZE));
  const safePage = Math.min(query.page, totalPages);
  const rows = await prisma.questionBankItem.findMany({
    where,
    orderBy: [{ category: "asc" }, { key: "asc" }],
    skip: (safePage - 1) * QUESTION_BANK_PAGE_SIZE,
    take: QUESTION_BANK_PAGE_SIZE,
    select: listSelectFallback,
  });
  return {
    items: rows.map(toListItem),
    filteredCount,
    totalPages,
    page: safePage,
  };
}

/** 公開題庫分頁（60s 快取；列表不含解析正文） */
export async function loadQuestionBankPage(
  query: QuestionBankListQuery,
): Promise<QuestionBankListResult> {
  try {
    return await getCachedQuestionBankPage(
      query.category,
      query.q,
      query.important ? "1" : "0",
      query.page,
    );
  } catch (e) {
    console.error("[question-bank] page query failed, ensuring schema:", e);
    try {
      await ensureQuestionBankSchema().catch(() => undefined);
      return await queryQuestionBankPageFallback(query);
    } catch (e2) {
      console.error("[question-bank] page fallback failed:", e2);
      return { items: [], filteredCount: 0, totalPages: 1, page: 1 };
    }
  }
}

async function queryQuestionBankExplanation(key: string): Promise<QuestionBankExplanationPayload | null> {
  const itemKey = key.trim();
  if (!itemKey) return null;
  const row = await prisma.questionBankItem.findFirst({
    where: { key: itemKey },
    select: { key: true, hintAnswer: true, importance: true },
  });
  if (!row) return null;
  const resolved = resolveQuestionExplanation(row);
  return {
    key: row.key,
    hintAnswer: resolved.hintAnswer,
    hasFullExplanation: resolved.hasFullExplanation,
    label: explanationDisplayLabel(resolved.hasFullExplanation),
  };
}

const getCachedExplanation = unstable_cache(
  async (key: string) => queryQuestionBankExplanation(key),
  ["question-bank-explanation-v1"],
  { revalidate: QUESTION_BANK_LIST_REVALIDATE_SEC, tags: [QUESTION_BANK_CACHE_TAG] },
);

/** 單題解析（點選 details 後載入） */
export async function loadQuestionBankExplanation(
  key: string,
): Promise<QuestionBankExplanationPayload | null> {
  try {
    return await getCachedExplanation(key.trim());
  } catch (e) {
    console.error("[question-bank] explanation query failed:", e);
    try {
      await ensureQuestionBankSchema().catch(() => undefined);
      return await queryQuestionBankExplanation(key);
    } catch (e2) {
      console.error("[question-bank] explanation fallback failed:", e2);
      return null;
    }
  }
}

/** 題庫匯入／編輯後失效 Next 快取 */
export function invalidateQuestionBankPublicCache(): void {
  revalidateTag(QUESTION_BANK_CACHE_TAG);
}
