/**
 * 法規清單公開頁快取（摘要列，不含 RAG 全文）。
 */

import { RegulationTier } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";

import prisma from "@/lib/prisma";
import { tierLabel, tierSortKey } from "@/lib/tier-order";

export const REGULATIONS_CACHE_TAG = "regulations-public";
export const REGULATIONS_LIST_REVALIDATE_SEC = 300;

export type RegulationListRow = {
  id: string;
  tier: RegulationTier;
  tierLabel: string;
  title: string;
  notes: string | null;
  lastModifiedAt: string | null;
  sourceUrl: string | null;
  sortOrder: number;
};

export type RegulationListSummary = {
  rows: RegulationListRow[];
  lawCount: number;
  questionBankCount: number;
};

async function queryRegulationListSummary(): Promise<RegulationListSummary> {
  const rows = await prisma.regulation.findMany({
    select: {
      id: true,
      tier: true,
      title: true,
      notes: true,
      lastModifiedAt: true,
      sourceUrl: true,
      sortOrder: true,
    },
  });
  rows.sort((a, b) => tierSortKey(a.tier, a.sortOrder) - tierSortKey(b.tier, b.sortOrder));

  const questionBankCount = rows.filter((r) => r.tier === RegulationTier.QUESTION_BANK).length;
  const lawCount = rows.length - questionBankCount;

  return {
    rows: rows.map((r) => ({
      id: r.id,
      tier: r.tier,
      tierLabel: tierLabel(r.tier),
      title: r.title,
      notes: r.notes,
      lastModifiedAt: r.lastModifiedAt?.toISOString() ?? null,
      sourceUrl: r.sourceUrl,
      sortOrder: r.sortOrder,
    })),
    lawCount,
    questionBankCount,
  };
}

export const getRegulationListSummary = unstable_cache(
  async () => queryRegulationListSummary(),
  ["regulation-list-summary-v1"],
  { revalidate: REGULATIONS_LIST_REVALIDATE_SEC, tags: [REGULATIONS_CACHE_TAG] },
);

export async function loadRegulationListSummary(): Promise<RegulationListSummary> {
  try {
    return await getRegulationListSummary();
  } catch (e) {
    console.error("[regulations] list query failed:", e);
    return { rows: [], lawCount: 0, questionBankCount: 0 };
  }
}

export function invalidateRegulationsPublicCache(): void {
  revalidateTag(REGULATIONS_CACHE_TAG);
}
