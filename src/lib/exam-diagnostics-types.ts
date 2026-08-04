import type { KnowledgeRadarSnapshot } from "@/lib/knowledge-radar";

export type DiagnosticRegulation = {
  slug: string;
  title: string;
  sourceUrl: string | null;
  reason?: string | null;
};

export type WrongQuestionBrief = {
  questionIndex: number;
  itemKey: string;
  category: string;
  knowledgeTags: string[];
  question: string;
  userAnswer: string | null;
  referenceAnswer: string | null;
  diagnosticNote: string | null;
};

export type ExamSessionDiagnosis = {
  sessionId: string;
  wrongCount: number;
  summary: string;
  recommendations: DiagnosticRegulation[];
  wrongQuestions: WrongQuestionBrief[];
  /** 確定性規則引擎產出的雷達快照 */
  radar: KnowledgeRadarSnapshot;
  model: string;
  diagnosedAt: string | null;
  alreadyDone: boolean;
};
