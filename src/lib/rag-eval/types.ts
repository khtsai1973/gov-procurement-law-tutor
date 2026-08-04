/** RAG 評測案例與結果型別（對齊 Ragas 常見指標語意） */

export type RagEvalCaseKind = "deterministic" | "off_topic" | "rag_gold" | "live";

export type RagEvalCase = {
  id: string;
  question: string;
  /** 評測用金標上下文（Faithfulness 依據）；live 模式可改用實際檢索 */
  contexts: string[];
  /** 參考答案（離線模式或對照） */
  reference_answer?: string;
  /** 答案應涵蓋的關鍵片段（啟發式 Faithfulness／完整性） */
  must_include: string[];
  /** 與問題相關的關鍵詞（Answer Relevance） */
  relevance_keywords: string[];
  kind: RagEvalCaseKind;
};

export type RagEvalCaseScore = {
  id: string;
  question: string;
  kind: RagEvalCaseKind;
  answer_preview: string;
  faithfulness: number;
  answer_relevance: number;
  context_recall: number | null;
  latency_ms: number | null;
  model?: string;
  notes?: string[];
};

export type RagEvalReport = {
  generated_at: string;
  mode: "offline" | "live";
  framework: "ragas-inspired-ts";
  thresholds: {
    faithfulness: number;
    answer_relevance: number;
    ttfb_p95_ms: number;
  };
  summary: {
    n: number;
    faithfulness_mean: number;
    answer_relevance_mean: number;
    context_recall_mean: number | null;
    pass: boolean;
  };
  cases: RagEvalCaseScore[];
  latency?: {
    page_ttfb?: unknown;
    note?: string;
  };
};
