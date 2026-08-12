/**
 * RAG Golden Dataset 型別（期末報告／管線比較用）
 *
 * 規劃：100 題（phase1 正式 50＋phase2 擴充 50）
 */

export const GOLDEN_CATEGORIES = [
  "法條直接查詢",
  "採購金額／門檻判斷",
  "招標方式",
  "決標方式",
  "限制性招標／第22條",
  "履約／驗收",
  "情境案例題",
  "跨條文／跨文件題",
  "錯誤前提題",
  "Out-of-domain",
] as const;

export type GoldenCategory = (typeof GOLDEN_CATEGORIES)[number];

export type GoldenDifficulty = "Easy" | "Medium" | "Hard";

/** answer=正常作答；correct=糾正錯誤前提；refuse=拒答／離題 */
export type GoldenExpectedBehavior = "answer" | "correct" | "refuse";

export type GoldenPhase = 1 | 2;

export type GoldenItem = {
  id: string;
  category: GoldenCategory;
  difficulty: GoldenDifficulty;
  question: string;
  gold_answer: string;
  /** 預期法規／函釋來源名稱或 corpus slug */
  expected_sources: string[];
  /** 預期條號，如「第22條」「第52條第1項」 */
  expected_articles: string[];
  expected_behavior: GoldenExpectedBehavior;
  notes: string;
  /** 評測輔助：答案應涵蓋之關鍵詞（Faithfulness／Hit Rate） */
  must_include?: string[];
  phase: GoldenPhase;
  /** phase2 尚未定稿時為 planned */
  status: "ready" | "planned";
};

export type GoldenDatasetMeta = {
  title: string;
  version: string;
  description: string;
  target_total: number;
  phase1_count: number;
  phase2_count: number;
  category_plan: Record<GoldenCategory, { total: number; phase1: number; phase2: number }>;
  metrics: string[];
};

export type GoldenDatasetFile = {
  meta: GoldenDatasetMeta;
  items: GoldenItem[];
};
