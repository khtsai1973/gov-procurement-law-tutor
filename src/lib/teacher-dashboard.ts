import { ensureFeedbackSchema } from "@/lib/ensure-feedback-schema";
import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { loadLearningDashboard, type LearningDashboardData, type WeakUnitStat } from "@/lib/learning-dashboard";
import { computeCategoryStats } from "@/lib/mock-exam";
import prisma from "@/lib/prisma";
import {
  loadAllStudentsLearning,
  loadStudentLearningDetail,
  type StudentLearningDetail,
  type StudentLearningRow,
} from "@/lib/teacher-stats";

export type TeacherClassDashboard = {
  students: StudentLearningRow[];
  summary: {
    studentCount: number;
    withExamCount: number;
    withQuestionCount: number;
    classAvgScorePct: number | null;
    totalExamSessions: number;
    totalQuestions: number;
    upCount: number;
    downCount: number;
    ratedCount: number;
    satisfactionRate: number | null;
  };
  /** 學員平均正確率分布 */
  scoreDistribution: { bucket: string; count: number }[];
  /** 平均分前幾名（有考試者） */
  leaderboard: {
    userId: string;
    label: string;
    avgScorePct: number;
    examSessionCount: number;
  }[];
  /** 全班常見弱項單元 */
  weakUnits: WeakUnitStat[];
};

export type TeacherStudentDashboard = {
  student: StudentLearningDetail;
  learning: LearningDashboardData;
};

function studentLabel(s: Pick<StudentLearningRow, "nickname" | "name" | "email">): string {
  return s.nickname ?? s.name ?? s.email ?? "學員";
}

function scoreBucket(pct: number): string {
  if (pct < 60) return "未滿 60%";
  if (pct < 70) return "60–69%";
  if (pct < 80) return "70–79%";
  if (pct < 90) return "80–89%";
  return "90–100%";
}

export async function loadTeacherClassDashboard(): Promise<TeacherClassDashboard> {
  await ensureTeacherSchema();
  await ensureFeedbackSchema();

  const students = await loadAllStudentsLearning();
  const studentIds = students.map((s) => s.userId);

  const withScores = students.filter((s) => s.avgScorePct != null);
  const classAvgScorePct =
    withScores.length > 0
      ? Math.round(
          (withScores.reduce((a, s) => a + (s.avgScorePct ?? 0), 0) / withScores.length) * 10,
        ) / 10
      : null;

  const bucketOrder = ["未滿 60%", "60–69%", "70–79%", "80–89%", "90–100%"];
  const bucketMap = new Map(bucketOrder.map((b) => [b, 0]));
  for (const s of withScores) {
    const b = scoreBucket(s.avgScorePct!);
    bucketMap.set(b, (bucketMap.get(b) ?? 0) + 1);
  }
  const scoreDistribution = bucketOrder.map((bucket) => ({
    bucket,
    count: bucketMap.get(bucket) ?? 0,
  }));

  const leaderboard = [...withScores]
    .sort((a, b) => (b.avgScorePct ?? 0) - (a.avgScorePct ?? 0))
    .slice(0, 10)
    .map((s) => ({
      userId: s.userId,
      label: studentLabel(s),
      avgScorePct: s.avgScorePct!,
      examSessionCount: s.examSessionCount,
    }));

  let weakUnits: WeakUnitStat[] = [];
  let upCount = 0;
  let downCount = 0;

  if (studentIds.length > 0) {
    const [categoryAnswers, up, down] = await Promise.all([
      prisma.mockExamSessionAnswer.findMany({
        where: {
          session: { userId: { in: studentIds }, finishedAt: { not: null } },
          revealed: true,
          isCorrect: { not: null },
        },
        select: { itemKey: true, isCorrect: true },
      }),
      prisma.userQuestion.count({ where: { userId: { in: studentIds }, feedback: "UP" } }),
      prisma.userQuestion.count({ where: { userId: { in: studentIds }, feedback: "DOWN" } }),
    ]);
    upCount = up;
    downCount = down;

    const keys = [...new Set(categoryAnswers.map((a) => a.itemKey))];
    const items = await prisma.questionBankItem.findMany({
      where: { key: { in: keys } },
      select: { key: true, category: true },
    });
    const catMap = new Map(items.map((i) => [i.key, i.category]));
    const categoryStats = computeCategoryStats(
      categoryAnswers.map((a) => ({
        category: catMap.get(a.itemKey) ?? "未分類",
        isCorrect: a.isCorrect,
        revealed: true,
      })),
    );
    weakUnits = categoryStats
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
  }

  const ratedCount = upCount + downCount;

  return {
    students,
    summary: {
      studentCount: students.length,
      withExamCount: students.filter((s) => s.examSessionCount > 0).length,
      withQuestionCount: students.filter((s) => s.questionCount > 0).length,
      classAvgScorePct,
      totalExamSessions: students.reduce((a, s) => a + s.examSessionCount, 0),
      totalQuestions: students.reduce((a, s) => a + s.questionCount, 0),
      upCount,
      downCount,
      ratedCount,
      satisfactionRate: ratedCount > 0 ? upCount / ratedCount : null,
    },
    scoreDistribution,
    leaderboard,
    weakUnits,
  };
}

export async function loadTeacherStudentDashboard(
  userId: string,
): Promise<TeacherStudentDashboard | null> {
  const [student, learning] = await Promise.all([
    loadStudentLearningDetail(userId),
    loadLearningDashboard(userId),
  ]);
  if (!student) return null;
  return { student, learning };
}

export { studentLabel };
