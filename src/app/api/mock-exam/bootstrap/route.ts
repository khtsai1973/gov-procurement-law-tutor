import { NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import type { MockExamAnalyticsData, MockExamHistoryRow } from "@/lib/mock-exam";
import { loadMockExamAnalytics } from "@/lib/mock-exam-analytics";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const emptyAnalytics: MockExamAnalyticsData = {
  scoreTrend: [],
  categoryStats: [],
  typeDistribution: [],
  summary: { totalSessions: 0, avgScorePct: null, bestScorePct: null },
  frequentWrong: [],
};

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true, name: true },
    }),
    prisma.mockExamSession.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: 30,
    }),
  ]);

  const nickname = user?.nickname ?? user?.name ?? null;
  const history: MockExamHistoryRow[] = rows.map((r) => ({
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
  }));

  let analytics = emptyAnalytics;
  try {
    analytics = await loadMockExamAnalytics(userId);
  } catch (e) {
    console.error("[mock-exam/bootstrap] analytics failed:", e);
  }

  return NextResponse.json({ nickname, history, analytics });
}
