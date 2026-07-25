import { ensureFeedbackSchema } from "@/lib/ensure-feedback-schema";
import prisma from "@/lib/prisma";

export type AnswerFeedbackStats = {
  totalAnswers: number;
  ratedCount: number;
  upCount: number;
  downCount: number;
  /** 點讚數 / 已評分數；無評分時為 null */
  satisfactionRate: number | null;
  byModel: {
    model: string;
    ratedCount: number;
    upCount: number;
    downCount: number;
    satisfactionRate: number | null;
  }[];
  recentComments: {
    id: string;
    feedback: "UP" | "DOWN";
    comment: string;
    question: string;
    answerModel: string | null;
    feedbackAt: Date;
  }[];
};

export async function loadAnswerFeedbackStats(): Promise<AnswerFeedbackStats> {
  await ensureFeedbackSchema();

  const [totalAnswers, upCount, downCount, ratedRows, recent] = await Promise.all([
    prisma.userQuestion.count({ where: { answer: { not: null } } }),
    prisma.userQuestion.count({ where: { feedback: "UP" } }),
    prisma.userQuestion.count({ where: { feedback: "DOWN" } }),
    prisma.userQuestion.findMany({
      where: { feedback: { not: null } },
      select: { answerModel: true, feedback: true },
    }),
    prisma.userQuestion.findMany({
      where: {
        feedback: { not: null },
        feedbackComment: { not: null },
        NOT: { feedbackComment: "" },
      },
      orderBy: { feedbackAt: "desc" },
      take: 20,
      select: {
        id: true,
        feedback: true,
        feedbackComment: true,
        question: true,
        answerModel: true,
        feedbackAt: true,
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

  return {
    totalAnswers,
    ratedCount,
    upCount,
    downCount,
    satisfactionRate,
    byModel,
    recentComments: recent
      .filter((r): r is typeof r & { feedback: "UP" | "DOWN"; feedbackComment: string } =>
        Boolean(r.feedback && r.feedbackComment),
      )
      .map((r) => ({
        id: r.id,
        feedback: r.feedback,
        comment: r.feedbackComment,
        question: r.question,
        answerModel: r.answerModel,
        feedbackAt: r.feedbackAt ?? new Date(0),
      })),
  };
}

export function formatPercent(rate: number | null): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}
