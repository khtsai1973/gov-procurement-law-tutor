import { ensureFeedbackSchema } from "@/lib/ensure-feedback-schema";
import { loadMockExamAnalytics } from "@/lib/mock-exam-analytics";
import type { MockExamAnalyticsData } from "@/lib/mock-exam";
import prisma from "@/lib/prisma";

export type PersonalFeedbackStats = {
  totalAnswers: number;
  ratedCount: number;
  upCount: number;
  downCount: number;
  satisfactionRate: number | null;
  byModel: {
    model: string;
    ratedCount: number;
    upCount: number;
    downCount: number;
    satisfactionRate: number | null;
  }[];
  /** 最近評分（含日期，供趨勢） */
  recentRatings: {
    id: string;
    feedback: "UP" | "DOWN";
    createdAt: string;
    label: string;
  }[];
  monthly: {
    month: string;
    label: string;
    upCount: number;
    downCount: number;
    satisfactionRate: number | null;
  }[];
};

export type WeakUnitStat = {
  category: string;
  wrongCount: number;
  total: number;
  correct: number;
  pct: number;
};

export type LearningDashboardData = {
  exam: MockExamAnalyticsData;
  weakUnits: WeakUnitStat[];
  feedback: PersonalFeedbackStats;
};

export async function loadPersonalFeedbackStats(userId: string): Promise<PersonalFeedbackStats> {
  await ensureFeedbackSchema();

  const [totalAnswers, upCount, downCount, ratedRows, recent] = await Promise.all([
    prisma.userQuestion.count({ where: { userId, answer: { not: null } } }),
    prisma.userQuestion.count({ where: { userId, feedback: "UP" } }),
    prisma.userQuestion.count({ where: { userId, feedback: "DOWN" } }),
    prisma.userQuestion.findMany({
      where: { userId, feedback: { not: null } },
      select: { answerModel: true, feedback: true },
    }),
    prisma.userQuestion.findMany({
      where: { userId, feedback: { not: null } },
      orderBy: { feedbackAt: "desc" },
      take: 40,
      select: {
        id: true,
        feedback: true,
        feedbackAt: true,
        createdAt: true,
      },
    }),
  ]);

  const ratedCount = upCount + downCount;
  const satisfactionRate = ratedCount > 0 ? upCount / ratedCount : null;

  const modelMap = new Map<string, { up: number; down: number }>();
  for (const row of ratedRows) {
    const key = row.answerModel?.trim() || "（未標示模型）";
    const cur = modelMap.get(key) ?? { up: 0, down: 0 };
    if (row.feedback === "UP") cur.up += 1;
    if (row.feedback === "DOWN") cur.down += 1;
    modelMap.set(key, cur);
  }

  const byModel = [...modelMap.entries()]
    .map(([model, { up, down }]) => {
      const rated = up + down;
      return {
        model,
        ratedCount: rated,
        upCount: up,
        downCount: down,
        satisfactionRate: rated > 0 ? up / rated : null,
      };
    })
    .sort((a, b) => b.ratedCount - a.ratedCount);

  const recentRatings = recent
    .filter((r): r is typeof r & { feedback: "UP" | "DOWN" } => Boolean(r.feedback))
    .map((r) => {
      const at = r.feedbackAt ?? r.createdAt;
      return {
        id: r.id,
        feedback: r.feedback,
        createdAt: at.toISOString(),
        label: new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric" }).format(at),
      };
    });

  const monthMap = new Map<string, { up: number; down: number; label: string }>();
  for (const r of recent) {
    if (r.feedback !== "UP" && r.feedback !== "DOWN") continue;
    const at = r.feedbackAt ?? r.createdAt;
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "short" }).format(at);
    const cur = monthMap.get(key) ?? { up: 0, down: 0, label };
    if (r.feedback === "UP") cur.up += 1;
    else cur.down += 1;
    monthMap.set(key, cur);
  }

  const monthly = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, { up, down, label }]) => {
      const rated = up + down;
      return {
        month,
        label,
        upCount: up,
        downCount: down,
        satisfactionRate: rated > 0 ? up / rated : null,
      };
    });

  return {
    totalAnswers,
    ratedCount,
    upCount,
    downCount,
    satisfactionRate,
    byModel,
    recentRatings,
    monthly,
  };
}

export async function loadLearningDashboard(userId: string): Promise<LearningDashboardData> {
  const [exam, feedback] = await Promise.all([
    loadMockExamAnalytics(userId),
    loadPersonalFeedbackStats(userId),
  ]);

  const weakUnits: WeakUnitStat[] = exam.categoryStats
    .filter((c) => c.total > 0)
    .map((c) => ({
      category: c.category,
      wrongCount: c.total - c.correct,
      total: c.total,
      correct: c.correct,
      pct: c.pct,
    }))
    .sort((a, b) => {
      if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
      return a.pct - b.pct;
    })
    .slice(0, 12);

  return { exam, weakUnits, feedback };
}
