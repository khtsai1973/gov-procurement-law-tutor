/**
 * 題庫公開頁快取：分類統計、模考類別選項（不含個人化資料）。
 */

import { revalidateTag, unstable_cache } from "next/cache";

import { ensureQuestionBankSchema } from "@/lib/ensure-question-bank-schema";
import {
  buildMockExamCategoryOptions,
  type MockExamCategoryOption,
} from "@/lib/mock-exam";
import prisma from "@/lib/prisma";

export const QUESTION_BANK_CACHE_TAG = "question-bank-public";
export const QUESTION_BANK_LIST_REVALIDATE_SEC = 60;

export type QuestionBankCategoryStat = {
  category: string;
  count: number;
};

export type QuestionBankCategorySummary = {
  categories: string[];
  stats: QuestionBankCategoryStat[];
  totalCount: number;
};

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

/** 題庫匯入／編輯後失效 Next 快取 */
export function invalidateQuestionBankPublicCache(): void {
  revalidateTag(QUESTION_BANK_CACHE_TAG);
}
