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
  model: string;
  diagnosedAt: string | null;
  alreadyDone: boolean;
};
