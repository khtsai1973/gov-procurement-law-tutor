import type { KnowledgeRadarSnapshot } from "@/lib/knowledge-radar";
import type {
  PersonalWeaknessReport,
  PracticeQuestionBrief,
} from "@/lib/personal-weakness-report";

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
  /** 完整標籤：知識軸 ∪ 條次／概念（送入 LLM） */
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
  /** 精準推薦練習題（至多 2 道） */
  practiceQuestions: PracticeQuestionBrief[];
  /** 結構化《個人化學習弱點診斷書》 */
  personalReport: PersonalWeaknessReport | null;
  wrongQuestions: WrongQuestionBrief[];
  /** 確定性規則引擎產出的雷達／能力矩陣快照 */
  radar: KnowledgeRadarSnapshot;
  model: string;
  diagnosedAt: string | null;
  alreadyDone: boolean;
};
