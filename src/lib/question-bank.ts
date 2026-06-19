import type { QuestionBankItem } from "@prisma/client";

import type { QuestionBankMatch } from "@/lib/question-bank-types";
import { prisma } from "@/lib/prisma";

const CACHE_MS = 60_000;
let cache: { items: QuestionBankItem[]; loadedAt: number } | null = null;

function normalize(text: string): string {
  return text.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

async function loadItems(): Promise<QuestionBankItem[]> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_MS) {
    return cache.items;
  }
  const items = await prisma.questionBankItem.findMany();
  cache = { items, loadedAt: now };
  return items;
}

/** 清除快取（匯入題庫後可呼叫） */
export function clearQuestionBankCache(): void {
  cache = null;
}

function matchesItem(queryNorm: string, item: QuestionBankItem): boolean {
  const qNorm = normalize(item.question);
  if (qNorm.length >= 4 && queryNorm.includes(qNorm)) return true;
  if (qNorm.length >= 6 && qNorm.includes(queryNorm) && queryNorm.length >= 4) return true;

  for (const kw of item.keywords) {
    const k = normalize(kw);
    if (k.length >= 2 && queryNorm.includes(k)) return true;
  }
  return false;
}

/**
 * 比對使用者查詢與題庫，回傳關鍵詞擴展、相關法規 slug 與可選導引。
 */
export async function matchQuestionBank(query: string): Promise<QuestionBankMatch> {
  const queryNorm = normalize(query);
  if (queryNorm.length < 2) {
    return { keywords: [], relatedSlugs: [], matchedKeys: [] };
  }

  const items = await loadItems();
  const matched = items.filter((item) => matchesItem(queryNorm, item));

  const keywords = new Set<string>();
  const relatedSlugs = new Set<string>();
  const matchedKeys: string[] = [];
  let hintAnswer: string | undefined;

  for (const item of matched) {
    matchedKeys.push(item.key);
    for (const kw of item.keywords) keywords.add(kw);
    for (const slug of item.relatedSlugs) relatedSlugs.add(slug);
    if (!hintAnswer && item.hintAnswer) hintAnswer = item.hintAnswer;
  }

  return {
    keywords: [...keywords],
    relatedSlugs: [...relatedSlugs],
    hintAnswer,
    matchedKeys,
  };
}
