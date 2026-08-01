import { scorePct } from "@/lib/mock-exam";
import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { withRlsBypass } from "@/lib/with-user-rls";

export type StudentLearningRow = {
  userId: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  role: string;
  questionCount: number;
  examSessionCount: number;
  avgScorePct: number | null;
  bestScorePct: number | null;
  lastExamAt: string | null;
  lastQuestionAt: string | null;
};

export type StudentLearningDetail = StudentLearningRow & {
  recentExams: {
    id: string;
    questionType: string;
    actualCount: number;
    correctCount: number;
    gradableCount: number;
    scorePct: number | null;
    finishedAt: string | null;
  }[];
  recentQuestions: {
    id: string;
    question: string;
    feedback: string | null;
    createdAt: string;
  }[];
};

export async function loadAllStudentsLearning(): Promise<StudentLearningRow[]> {
  await ensureTeacherSchema();

  const users = await withRlsBypass((tx) =>
    tx.user.findMany({
      where: { role: "USER" },
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        role: true,
        _count: {
          select: {
            questions: true,
            mockExamSessions: true,
          },
        },
        questions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
        mockExamSessions: {
          where: { finishedAt: { not: null } },
          orderBy: { finishedAt: "desc" },
          select: {
            correctCount: true,
            gradableCount: true,
            finishedAt: true,
          },
        },
      },
    }),
  );

  return users.map((u) => {
    const finished = u.mockExamSessions;
    const scores = finished
      .map((s) => scorePct(s.correctCount, s.gradableCount))
      .filter((n): n is number => n != null);
    const avgScorePct =
      scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
    const bestScorePct = scores.length > 0 ? Math.max(...scores) : null;

    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      nickname: u.nickname,
      role: u.role,
      questionCount: u._count.questions,
      examSessionCount: finished.length,
      avgScorePct,
      bestScorePct,
      lastExamAt: finished[0]?.finishedAt?.toISOString() ?? null,
      lastQuestionAt: u.questions[0]?.createdAt.toISOString() ?? null,
    };
  });
}

export async function loadStudentLearningDetail(
  userId: string,
): Promise<StudentLearningDetail | null> {
  await ensureTeacherSchema();

  return withRlsBypass(async (tx) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      nickname: true,
      role: true,
    },
  });
  if (!user) return null;

  const [sessions, questions, allFinished, questionCount] = await Promise.all([
    tx.mockExamSession.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: 20,
      select: {
        id: true,
        questionType: true,
        actualCount: true,
        correctCount: true,
        gradableCount: true,
        finishedAt: true,
      },
    }),
    tx.userQuestion.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        question: true,
        feedback: true,
        createdAt: true,
      },
    }),
    tx.mockExamSession.findMany({
      where: { userId, finishedAt: { not: null } },
      select: { correctCount: true, gradableCount: true, finishedAt: true },
      orderBy: { finishedAt: "desc" },
    }),
    tx.userQuestion.count({ where: { userId } }),
  ]);

  const scores = allFinished
    .map((s) => scorePct(s.correctCount, s.gradableCount))
    .filter((n): n is number => n != null);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    role: user.role,
    questionCount,
    examSessionCount: allFinished.length,
    avgScorePct:
      scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    bestScorePct: scores.length > 0 ? Math.max(...scores) : null,
    lastExamAt: allFinished[0]?.finishedAt?.toISOString() ?? null,
    lastQuestionAt: questions[0]?.createdAt.toISOString() ?? null,
    recentExams: sessions.map((s) => ({
      id: s.id,
      questionType: s.questionType,
      actualCount: s.actualCount,
      correctCount: s.correctCount,
      gradableCount: s.gradableCount,
      scorePct: scorePct(s.correctCount, s.gradableCount),
      finishedAt: s.finishedAt?.toISOString() ?? null,
    })),
    recentQuestions: questions.map((q) => ({
      id: q.id,
      question: q.question,
      feedback: q.feedback,
      createdAt: q.createdAt.toISOString(),
    })),
  };
  });
}
