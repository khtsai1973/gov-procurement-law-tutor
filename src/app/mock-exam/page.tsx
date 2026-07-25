import { MockExamAnalyticsCharts } from "@/components/MockExamAnalyticsCharts";
import { MockExamHistory } from "@/components/MockExamHistory";
import { MockExamPanel } from "@/components/MockExamPanel";
import type { MockExamAnalyticsData, MockExamHistoryRow } from "@/lib/mock-exam";
import { loadMockExamAnalytics } from "@/lib/mock-exam-analytics";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MockExamPage() {
  const session = await getSession();
  let initialNickname: string | null = null;
  let history: MockExamHistoryRow[] = [];
  let analytics: MockExamAnalyticsData = {
    scoreTrend: [],
    categoryStats: [],
    typeDistribution: [],
    summary: { totalSessions: 0, avgScorePct: null, bestScorePct: null },
    frequentWrong: [],
  };

  let categories: { name: string; count: number }[] = [];
  try {
    const categoryGroups = await prisma.questionBankItem.groupBy({
      by: ["category"],
      _count: { _all: true },
      orderBy: { category: "asc" },
    });
    categories = categoryGroups.map((g) => ({
      name: g.category,
      count: g._count._all,
    }));
  } catch (e) {
    console.error("[mock-exam] load categories failed:", e);
  }

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { nickname: true, name: true },
    });
    initialNickname = user?.nickname ?? user?.name ?? null;

    const rows = await prisma.mockExamSession.findMany({
      where: { userId: session.user.id, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: 30,
    });
    history = rows.map((r) => ({
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

    analytics = await loadMockExamAnalytics(session.user.id);
  }

  return (
    <MockExamPanel
      signedIn={!!session?.user}
      initialNickname={initialNickname}
      categories={categories}
      history={<MockExamHistory records={history} />}
      analytics={<MockExamAnalyticsCharts data={analytics} />}
    />
  );
}
