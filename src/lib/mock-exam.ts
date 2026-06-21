import type { QuestionBankItem } from "@prisma/client";

export type MockExamQuestionType = "TRUE_FALSE" | "MULTIPLE_CHOICE";

export type MockExamOption = {
  value: string;
  label: string;
};

export type MockExamQuestionPayload = {
  key: string;
  question: string;
  type: MockExamQuestionType;
  category: string;
  options: MockExamOption[];
  relatedSlugs: string[];
};

export type MockExamRegulationLink = {
  slug: string;
  title: string;
  sourceUrl: string | null;
};

export type MockExamRevealResult = {
  key: string;
  referenceAnswer: string | null;
  isCorrect: boolean | null;
  hintAnswer: string | null;
  regulations: MockExamRegulationLink[];
  supplement: string | null;
  sourceNote: string | null;
};

const MC_OPTION_RE = /\(\s*([1-4])\s*\)\s*([^()]+?)(?=\(\s*[1-4]\s*\)|$)/g;

export function inferMockExamQuestionType(item: Pick<QuestionBankItem, "key" | "question">): MockExamQuestionType | null {
  if (item.key.includes("是非題")) return "TRUE_FALSE";
  if (item.key.includes("選擇題")) return "MULTIPLE_CHOICE";
  if (/\(\s*[1-4]\s*\)/.test(item.question)) return "MULTIPLE_CHOICE";
  return null;
}

export function parseMultipleChoiceOptions(question: string): MockExamOption[] {
  const options: MockExamOption[] = [];
  const re = new RegExp(MC_OPTION_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(question)) !== null) {
    options.push({
      value: match[1]!,
      label: match[2]!.trim(),
    });
  }
  return options;
}

export function getMockExamOptions(
  item: Pick<QuestionBankItem, "key" | "question">,
  type: MockExamQuestionType,
): MockExamOption[] {
  if (type === "TRUE_FALSE") {
    return [
      { value: "O", label: "是（○）" },
      { value: "X", label: "否（×）" },
    ];
  }
  const parsed = parseMultipleChoiceOptions(item.question);
  if (parsed.length > 0) return parsed;
  return [
    { value: "1", label: "選項 (1)" },
    { value: "2", label: "選項 (2)" },
    { value: "3", label: "選項 (3)" },
    { value: "4", label: "選項 (4)" },
  ];
}

export function parseReferenceAnswer(
  hintAnswer: string | null | undefined,
  type: MockExamQuestionType,
): string | null {
  if (!hintAnswer) return null;
  const match = hintAnswer.match(/參考答案為\s*([^。]+)/);
  if (!match) return null;
  let raw = match[1]!.trim();

  if (type === "TRUE_FALSE") {
    if (/^[OXox]$/.test(raw)) return raw.toUpperCase();
    if (raw === "是" || raw === "○") return "O";
    if (raw === "否" || raw === "×") return "X";
    const opt = raw.match(/\(\s*(\d)\s*\)/);
    if (opt?.[1] === "1") return "O";
    if (opt?.[1] === "2") return "X";
    if (/^[12]$/.test(raw)) return raw === "1" ? "O" : "X";
    return raw.toUpperCase();
  }

  const opt = raw.match(/\(\s*(\d)\s*\)/);
  if (opt) return opt[1]!;
  if (/^[1-4]$/.test(raw)) return raw;
  return null;
}

export function gradeMockExamAnswer(
  userAnswer: string,
  referenceAnswer: string | null,
): boolean | null {
  if (!referenceAnswer) return null;
  return userAnswer.trim().toUpperCase() === referenceAnswer.trim().toUpperCase();
}

export function toMockExamQuestionPayload(item: QuestionBankItem): MockExamQuestionPayload | null {
  const type = inferMockExamQuestionType(item);
  if (!type) return null;
  return {
    key: item.key,
    question: item.question,
    type,
    category: item.category,
    options: getMockExamOptions(item, type),
    relatedSlugs: item.relatedSlugs,
  };
}

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

export const MOCK_EXAM_COUNT_OPTIONS = [5, 10, 50] as const;

export const NICKNAME_PRESETS = ["採購學員", "法規考專家", "實務小編", "工程會考生", "採購達人"] as const;

/** 計時模式：每題 60 秒 */
export function mockExamTimeLimitSec(questionCount: number, timedMode: boolean): number | null {
  if (!timedMode) return null;
  return questionCount * 60;
}

export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, totalSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function mockExamTypeLabel(type: MockExamQuestionType | string): string {
  return type === "TRUE_FALSE" ? "是非題" : "選擇題";
}

export type MockExamHistoryRow = {
  id: string;
  nickname: string | null;
  questionType: string;
  actualCount: number;
  correctCount: number;
  gradableCount: number;
  answeredCount: number;
  timedMode: boolean;
  timeLimitSec: number | null;
  elapsedSec: number | null;
  startedAt: string;
  finishedAt: string | null;
};

export type MockExamAnswerBreakdown = {
  correct: number;
  wrong: number;
  unrevealed: number;
  ungradable: number;
};

export type MockExamCategoryStat = {
  category: string;
  correct: number;
  total: number;
  pct: number;
};

export type MockExamScoreTrendPoint = {
  sessionId: string;
  date: string;
  label: string;
  scorePct: number | null;
  correctCount: number;
  gradableCount: number;
  questionType: string;
  timedMode: boolean;
};

export type MockExamAnalyticsData = {
  scoreTrend: MockExamScoreTrendPoint[];
  categoryStats: MockExamCategoryStat[];
  typeDistribution: { type: string; label: string; count: number }[];
  summary: {
    totalSessions: number;
    avgScorePct: number | null;
    bestScorePct: number | null;
  };
  frequentWrong: { itemKey: string; question: string; wrongCount: number }[];
};

export type MockExamSessionAnswerDetail = {
  questionIndex: number;
  itemKey: string;
  question: string;
  category: string;
  userAnswer: string | null;
  referenceAnswer: string | null;
  isCorrect: boolean | null;
  revealed: boolean;
  sourceNote: string | null;
  hintAnswer: string | null;
};

export type MockExamSessionDetail = MockExamHistoryRow & {
  requestedCount: number;
  answers: MockExamSessionAnswerDetail[];
  breakdown: MockExamAnswerBreakdown;
  categoryStats: MockExamCategoryStat[];
};

export function computeAnswerBreakdown(
  answers: Pick<MockExamSessionAnswerDetail, "isCorrect" | "revealed">[],
): MockExamAnswerBreakdown {
  const breakdown: MockExamAnswerBreakdown = {
    correct: 0,
    wrong: 0,
    unrevealed: 0,
    ungradable: 0,
  };
  for (const a of answers) {
    if (!a.revealed) {
      breakdown.unrevealed++;
      continue;
    }
    if (a.isCorrect === true) breakdown.correct++;
    else if (a.isCorrect === false) breakdown.wrong++;
    else breakdown.ungradable++;
  }
  return breakdown;
}

export function computeCategoryStats(
  answers: Pick<MockExamSessionAnswerDetail, "category" | "isCorrect" | "revealed">[],
): MockExamCategoryStat[] {
  const map = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    if (!a.revealed || a.isCorrect === null) continue;
    const row = map.get(a.category) ?? { correct: 0, total: 0 };
    row.total++;
    if (a.isCorrect) row.correct++;
    map.set(a.category, row);
  }
  return [...map.entries()]
    .map(([category, { correct, total }]) => ({
      category,
      correct,
      total,
      pct: total > 0 ? Math.round((correct / total) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct);
}

export function scorePct(correctCount: number, gradableCount: number): number | null {
  if (gradableCount <= 0) return null;
  return Math.round((correctCount / gradableCount) * 100);
}

export function formatAnswerLabel(value: string | null, type: MockExamQuestionType | string): string {
  if (!value) return "—";
  if (type === "TRUE_FALSE") {
    if (value === "O") return "是（○）";
    if (value === "X") return "否（×）";
  }
  return value;
}
