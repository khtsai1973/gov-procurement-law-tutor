/**
 * 依模擬考試歷史＋題庫標籤，彙總個人弱點（供題庫頁顯示）。
 */

import { ensureDiagnosticsSchema } from "@/lib/ensure-diagnostics-schema";
import { computeKnowledgeRadar } from "@/lib/knowledge-radar";
import { resolveKnowledgeTags } from "@/lib/knowledge-tags";
import prisma from "@/lib/prisma";

export type WeakCategoryStat = {
  category: string;
  wrong: number;
  total: number;
  pct: number;
};

export type UserQuestionBankWeakness = {
  weakTags: string[];
  strongTags: string[];
  weakCategories: WeakCategoryStat[];
  recentWrongKeys: string[];
  totalWrong: number;
  totalGraded: number;
};

export async function loadUserQuestionBankWeakness(
  userId: string,
  opts?: { sessionLimit?: number },
): Promise<UserQuestionBankWeakness> {
  await ensureDiagnosticsSchema().catch(() => undefined);

  const sessionLimit = opts?.sessionLimit ?? 20;
  const sessions = await prisma.mockExamSession.findMany({
    where: { userId, finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
    take: sessionLimit,
    select: {
      id: true,
      answers: {
        where: { revealed: true, isCorrect: { not: null } },
        select: {
          itemKey: true,
          isCorrect: true,
          revealed: true,
        },
      },
    },
  });

  const keys = [
    ...new Set(sessions.flatMap((s) => s.answers.map((a) => a.itemKey))),
  ];
  const bankItems =
    keys.length > 0
      ? await prisma.questionBankItem.findMany({
          where: { key: { in: keys } },
          select: {
            key: true,
            category: true,
            keywords: true,
            knowledgeTags: true,
            question: true,
          },
        })
      : [];
  const byKey = new Map(bankItems.map((b) => [b.key, b]));

  const taggedRows: Array<{
    isCorrect: boolean | null;
    revealed: boolean;
    tags: string[];
  }> = [];
  const categoryMap = new Map<string, { wrong: number; total: number }>();
  const recentWrongKeys: string[] = [];
  let totalWrong = 0;
  let totalGraded = 0;

  for (const session of sessions) {
    for (const a of session.answers) {
      if (!a.revealed || a.isCorrect === null) continue;
      totalGraded += 1;
      const item = byKey.get(a.itemKey);
      const tags = resolveKnowledgeTags({
        category: item?.category ?? "",
        keywords: item?.keywords ?? [],
        knowledgeTags: item?.knowledgeTags ?? [],
        question: item?.question ?? "",
      });
      taggedRows.push({
        isCorrect: a.isCorrect,
        revealed: true,
        tags,
      });

      const cat = item?.category?.trim() || "未分類";
      const cell = categoryMap.get(cat) ?? { wrong: 0, total: 0 };
      cell.total += 1;
      if (!a.isCorrect) {
        cell.wrong += 1;
        totalWrong += 1;
        if (recentWrongKeys.length < 12 && !recentWrongKeys.includes(a.itemKey)) {
          recentWrongKeys.push(a.itemKey);
        }
      }
      categoryMap.set(cat, cell);
    }
  }

  const radar = computeKnowledgeRadar(taggedRows);
  const weakCategories = [...categoryMap.entries()]
    .map(([category, cell]) => ({
      category,
      wrong: cell.wrong,
      total: cell.total,
      pct: cell.total > 0 ? Math.round(((cell.total - cell.wrong) / cell.total) * 100) : 0,
    }))
    .filter((c) => c.wrong > 0)
    .sort((a, b) => a.pct - b.pct || b.wrong - a.wrong)
    .slice(0, 8);

  return {
    weakTags: radar.weakTags,
    strongTags: radar.strongTags,
    weakCategories,
    recentWrongKeys,
    totalWrong,
    totalGraded,
  };
}
