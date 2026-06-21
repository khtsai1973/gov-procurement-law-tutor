import {
  computeAnswerBreakdown,
  computeCategoryStats,
  mockExamTypeLabel,
  scorePct,
  type MockExamAnalyticsData,
  type MockExamHistoryRow,
  type MockExamSessionDetail,
} from "@/lib/mock-exam";
import prisma from "@/lib/prisma";

const ANALYTICS_SESSION_LIMIT = 100;

function toHistoryRow(
  r: Awaited<ReturnType<typeof prisma.mockExamSession.findMany>>[number],
): MockExamHistoryRow {
  return {
    id: r.id,
    nickname: r.nickname,
    questionType: r.questionType,
    actualCount: r.actualCount,
    correctCount: r.correctCount,
    gradableCount: r.gradableCount,
    answeredCount: r.answeredCount,
    timedMode: r.timedMode,
    timeLimitSec: r.timeLimitSec,
    elapsedSec: r.elapsedSec,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  };
}

export async function loadMockExamSessionDetail(
  userId: string,
  sessionId: string,
): Promise<MockExamSessionDetail | null> {
  const session = await prisma.mockExamSession.findFirst({
    where: { id: sessionId, userId, finishedAt: { not: null } },
    include: {
      answers: { orderBy: { questionIndex: "asc" } },
    },
  });
  if (!session) return null;

  const itemKeys = session.answers.map((a) => a.itemKey);
  const items = await prisma.questionBankItem.findMany({
    where: { key: { in: itemKeys } },
    select: { key: true, question: true, category: true, hintAnswer: true },
  });
  const itemMap = new Map(items.map((i) => [i.key, i]));

  const answers = session.answers.map((a) => {
    const item = itemMap.get(a.itemKey);
    return {
      questionIndex: a.questionIndex,
      itemKey: a.itemKey,
      question: item?.question ?? a.itemKey,
      category: item?.category ?? "未分類",
      userAnswer: a.userAnswer,
      referenceAnswer: a.referenceAnswer,
      isCorrect: a.isCorrect,
      revealed: a.revealed,
      sourceNote: a.sourceNote,
      hintAnswer: item?.hintAnswer ?? null,
    };
  });

  return {
    ...toHistoryRow(session),
    requestedCount: session.requestedCount,
    answers,
    breakdown: computeAnswerBreakdown(answers),
    categoryStats: computeCategoryStats(answers),
  };
}

export async function loadMockExamAnalytics(userId: string): Promise<MockExamAnalyticsData> {
  const sessions = await prisma.mockExamSession.findMany({
    where: { userId, finishedAt: { not: null } },
    orderBy: { finishedAt: "asc" },
    take: ANALYTICS_SESSION_LIMIT,
    select: {
      id: true,
      questionType: true,
      timedMode: true,
      correctCount: true,
      gradableCount: true,
      finishedAt: true,
    },
  });

  const scoreTrend = sessions.map((s) => {
    const date = s.finishedAt!.toISOString();
    const label = new Intl.DateTimeFormat("zh-TW", {
      month: "numeric",
      day: "numeric",
    }).format(s.finishedAt!);
    return {
      sessionId: s.id,
      date,
      label,
      scorePct: scorePct(s.correctCount, s.gradableCount),
      correctCount: s.correctCount,
      gradableCount: s.gradableCount,
      questionType: s.questionType,
      timedMode: s.timedMode,
    };
  });

  const typeMap = new Map<string, number>();
  for (const s of sessions) {
    typeMap.set(s.questionType, (typeMap.get(s.questionType) ?? 0) + 1);
  }
  const typeDistribution = [...typeMap.entries()].map(([type, count]) => ({
    type,
    label: mockExamTypeLabel(type),
    count,
  }));

  const gradableSessions = sessions.filter((s) => s.gradableCount > 0);
  const scoreValues = gradableSessions.map((s) => scorePct(s.correctCount, s.gradableCount)!);
  const avgScorePct =
    scoreValues.length > 0
      ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
      : null;
  const bestScorePct = scoreValues.length > 0 ? Math.max(...scoreValues) : null;

  const answerRows = await prisma.mockExamSessionAnswer.findMany({
    where: {
      session: { userId, finishedAt: { not: null } },
      isCorrect: false,
    },
    select: { itemKey: true },
  });

  const wrongCountMap = new Map<string, number>();
  for (const row of answerRows) {
    wrongCountMap.set(row.itemKey, (wrongCountMap.get(row.itemKey) ?? 0) + 1);
  }

  const topWrongKeys = [...wrongCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([itemKey]) => itemKey);

  const wrongItems = await prisma.questionBankItem.findMany({
    where: { key: { in: topWrongKeys } },
    select: { key: true, question: true },
  });
  const wrongItemMap = new Map(wrongItems.map((i) => [i.key, i.question]));

  const frequentWrong = topWrongKeys.map((itemKey) => ({
    itemKey,
    question: wrongItemMap.get(itemKey) ?? itemKey,
    wrongCount: wrongCountMap.get(itemKey) ?? 0,
  }));

  const categoryAnswers = await prisma.mockExamSessionAnswer.findMany({
    where: {
      session: { userId, finishedAt: { not: null } },
      revealed: true,
      isCorrect: { not: null },
    },
    select: { itemKey: true, isCorrect: true },
  });

  const categoryItemKeys = [...new Set(categoryAnswers.map((a) => a.itemKey))];
  const categoryItems = await prisma.questionBankItem.findMany({
    where: { key: { in: categoryItemKeys } },
    select: { key: true, category: true },
  });
  const categoryItemMap = new Map(categoryItems.map((i) => [i.key, i.category]));

  const categoryStats = computeCategoryStats(
    categoryAnswers.map((a) => ({
      category: categoryItemMap.get(a.itemKey) ?? "未分類",
      isCorrect: a.isCorrect,
      revealed: true,
    })),
  );

  return {
    scoreTrend,
    categoryStats,
    typeDistribution,
    summary: {
      totalSessions: sessions.length,
      avgScorePct,
      bestScorePct,
    },
    frequentWrong,
  };
}
