/**
 * 老師用：全體學員匿名化統計（僅彙總，不輸出可識別個資）。
 */

import { ensureDiagnosticsSchema } from "@/lib/ensure-diagnostics-schema";
import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { computeKnowledgeRadar, type KnowledgeRadarSnapshot } from "@/lib/knowledge-radar";
import { resolveKnowledgeTags } from "@/lib/knowledge-tags";
import { mockExamTypeLabel, scorePct } from "@/lib/mock-exam";
import { withRlsBypass } from "@/lib/with-user-rls";

export type ScoreBucket = {
  /** 如「0–59」「60–69」 */
  label: string;
  min: number;
  max: number;
  count: number;
};

export type AnonymousCohortDashboard = {
  /** 明確標示：本資料不含姓名／信箱／userId */
  anonymized: true;
  summary: {
    studentCount: number;
    studentsWithExams: number;
    studentsWithQuestions: number;
    totalExamSessions: number;
    totalQuestionsAsked: number;
    cohortAvgScorePct: number | null;
    cohortMedianScorePct: number | null;
  };
  scoreBuckets: ScoreBucket[];
  examTypeDistribution: { type: string; label: string; count: number }[];
  /** 全體錯題／正答彙總的題庫類別正確率（弱→強） */
  categoryStats: {
    category: string;
    correct: number;
    total: number;
    pct: number;
  }[];
  /** 全體知識標籤雷達（規則引擎） */
  knowledgeRadar: KnowledgeRadarSnapshot;
  /** 近若干週活動量（無個資） */
  activityByWeek: { week: string; label: string; exams: number; questions: number }[];
  /** 回答滿意度彙總（👍／👎） */
  feedback: {
    ratedCount: number;
    upCount: number;
    downCount: number;
    satisfactionRate: number | null;
  };
};

const SCORE_BUCKET_DEFS: { label: string; min: number; max: number }[] = [
  { label: "0–59", min: 0, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70–79", min: 70, max: 79 },
  { label: "80–89", min: 80, max: 89 },
  { label: "90–100", min: 90, max: 100 },
];

/** 純函式：由每位學員平均分計算分數區間人數（可單測） */
export function buildScoreBuckets(avgScores: number[]): ScoreBucket[] {
  return SCORE_BUCKET_DEFS.map((def) => ({
    ...def,
    count: avgScores.filter((s) => s >= def.min && s <= def.max).length,
  }));
}

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
}

function weekKey(d: Date): { week: string; label: string } {
  // ISO 週：用週一為起點
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const week = `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  const label = `${date.getUTCFullYear()} 第 ${weekNo} 週`;
  return { week, label };
}

/**
 * 載入全體學員匿名化儀表板資料。
 * 回傳物件保證不含 email／name／nickname／userId。
 */
export async function loadAnonymousCohortDashboard(): Promise<AnonymousCohortDashboard> {
  // knowledgeTags 由診斷 schema 補齊；缺欄位時 Prisma select 會直接讓整頁 500
  await Promise.all([ensureTeacherSchema(), ensureDiagnosticsSchema()]);

  const data = await withRlsBypass(async (tx) => {
    const users = await tx.user.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        _count: { select: { questions: true } },
        mockExamSessions: {
          where: { finishedAt: { not: null } },
          select: {
            correctCount: true,
            gradableCount: true,
            questionType: true,
            finishedAt: true,
            answers: {
              select: {
                itemKey: true,
                isCorrect: true,
                revealed: true,
              },
            },
          },
        },
        questions: {
          select: {
            createdAt: true,
            feedback: true,
          },
        },
      },
    });

    const itemKeys = new Set<string>();
    for (const u of users) {
      for (const s of u.mockExamSessions) {
        for (const a of s.answers) itemKeys.add(a.itemKey);
      }
    }

    const bankItems =
      itemKeys.size > 0
        ? await tx.questionBankItem.findMany({
            where: { key: { in: [...itemKeys] } },
            select: {
              key: true,
              category: true,
              keywords: true,
              relatedSlugs: true,
              question: true,
              knowledgeTags: true,
            },
          })
        : [];

    return { users, bankItems };
  });

  const { users, bankItems } = data;
  const bankMap = new Map(bankItems.map((i) => [i.key, i]));

  const studentCount = users.length;
  let studentsWithExams = 0;
  let studentsWithQuestions = 0;
  let totalExamSessions = 0;
  let totalQuestionsAsked = 0;
  const perStudentAvg: number[] = [];
  const typeMap = new Map<string, number>();
  const categoryMap = new Map<string, { correct: number; total: number }>();
  const taggedRows: { isCorrect: boolean | null; revealed: boolean; tags: string[] }[] = [];
  const weekMap = new Map<string, { label: string; exams: number; questions: number }>();
  let upCount = 0;
  let downCount = 0;

  for (const u of users) {
    const qCount = u._count.questions;
    totalQuestionsAsked += qCount;
    if (qCount > 0) studentsWithQuestions += 1;

    const finished = u.mockExamSessions;
    if (finished.length > 0) studentsWithExams += 1;
    totalExamSessions += finished.length;

    const scores = finished
      .map((s) => scorePct(s.correctCount, s.gradableCount))
      .filter((n): n is number => n != null);
    if (scores.length > 0) {
      perStudentAvg.push(
        Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      );
    }

    for (const s of finished) {
      typeMap.set(s.questionType, (typeMap.get(s.questionType) ?? 0) + 1);
      if (s.finishedAt) {
        const { week, label } = weekKey(s.finishedAt);
        const row = weekMap.get(week) ?? { label, exams: 0, questions: 0 };
        row.exams += 1;
        weekMap.set(week, row);
      }

      for (const a of s.answers) {
        if (!a.revealed || a.isCorrect === null) continue;
        const item = bankMap.get(a.itemKey);
        const category = item?.category ?? "未分類";
        const cat = categoryMap.get(category) ?? { correct: 0, total: 0 };
        cat.total += 1;
        if (a.isCorrect) cat.correct += 1;
        categoryMap.set(category, cat);

        taggedRows.push({
          isCorrect: a.isCorrect,
          revealed: a.revealed,
          tags: item
            ? resolveKnowledgeTags(item)
            : ["招標程序"],
        });
      }
    }

    for (const q of u.questions) {
      const { week, label } = weekKey(q.createdAt);
      const row = weekMap.get(week) ?? { label, exams: 0, questions: 0 };
      row.questions += 1;
      weekMap.set(week, row);
      if (q.feedback === "UP") upCount += 1;
      if (q.feedback === "DOWN") downCount += 1;
    }
  }

  const cohortAvgScorePct =
    perStudentAvg.length > 0
      ? Math.round((perStudentAvg.reduce((a, b) => a + b, 0) / perStudentAvg.length) * 10) / 10
      : null;

  const categoryStats = [...categoryMap.entries()]
    .map(([category, { correct, total }]) => ({
      category,
      correct,
      total,
      pct: total > 0 ? Math.round((correct / total) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total);

  const examTypeDistribution = [...typeMap.entries()]
    .map(([type, count]) => ({
      type,
      label: mockExamTypeLabel(type),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const activityByWeek = [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, v]) => ({ week, label: v.label, exams: v.exams, questions: v.questions }));

  const ratedCount = upCount + downCount;

  const dashboard: AnonymousCohortDashboard = {
    anonymized: true,
    summary: {
      studentCount,
      studentsWithExams,
      studentsWithQuestions,
      totalExamSessions,
      totalQuestionsAsked,
      cohortAvgScorePct,
      cohortMedianScorePct: median(perStudentAvg),
    },
    scoreBuckets: buildScoreBuckets(perStudentAvg),
    examTypeDistribution,
    categoryStats,
    knowledgeRadar: computeKnowledgeRadar(taggedRows),
    activityByWeek,
    feedback: {
      ratedCount,
      upCount,
      downCount,
      satisfactionRate: ratedCount > 0 ? Math.round((upCount / ratedCount) * 1000) / 1000 : null,
    },
  };

  // 防禦：確保序列化後不含個資欄位名意外帶出
  assertNoPiiKeys(dashboard);
  return dashboard;
}

/** 防禦：序列化後不得出現個資 JSON key（可單測） */
export function assertNoPiiKeys(payload: unknown): void {
  const banned = ["email", "name", "nickname", "userId", "user_id"];
  const json = JSON.stringify(payload);
  for (const key of banned) {
    // 允許出現在說明文字，但不允許 JSON key
    if (new RegExp(`"${key}"\\s*:`).test(json)) {
      throw new Error(`[anonymous-dashboard] unexpected PII key: ${key}`);
    }
  }
}
