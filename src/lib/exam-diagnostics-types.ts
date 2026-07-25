export type DiagnosticRegulation = {
  slug: string;
  title: string;
  sourceUrl: string | null;
};

export type ExamDiagnosticItem = {
  answerId: string;
  questionIndex: number;
  itemKey: string;
  category: string;
  question: string;
  userAnswer: string | null;
  referenceAnswer: string | null;
  clarification: string;
  regulations: DiagnosticRegulation[];
  model: string;
};
