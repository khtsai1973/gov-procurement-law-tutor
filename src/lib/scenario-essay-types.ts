/**
 * 情境申論 Rubric 權重與批改結果型別（前後端共用，無 Node／OpenAI 依賴）
 */

export const RUBRIC_WEIGHTS = {
  citation: 30,
  procedure: 40,
  coherence: 30,
} as const;

export type RubricDimensionKey = keyof typeof RUBRIC_WEIGHTS;

export type RubricDimensionScore = {
  score: number;
  max: number;
  comment: string;
};

export type ScenarioEssayGradeResult = {
  ok: true;
  questionId: string;
  scores: {
    citation: RubricDimensionScore;
    procedure: RubricDimensionScore;
    coherence: RubricDimensionScore;
  };
  total: number;
  deductions: string[];
  strengths: string[];
  modelAnswer: string;
  model: string;
  /** 是否為規則／離線 fallback */
  fallback: boolean;
};

export type ScenarioEssayGradeError = {
  ok: false;
  error: string;
};
