/**
 * Hybrid Search（BM25 + Dense Vector + RRF）可調權重。
 * 預設與既有生產行為一致；可用環境變數微調。
 */

export type RagHybridConfig = {
  /** 是否啟用向量支路（false 時僅 BM25／關鍵字） */
  enableVector: boolean;
  /** hybridScore 內 BM25 權重 */
  bm25Weight: number;
  /** hybridScore 內關鍵字規則權重 */
  keywordWeight: number;
  /** hybridScore 內語意（dense）權重 */
  semanticWeight: number;
  /** hybridScore 內法規層級加權 */
  tierWeight: number;
  /** hybridScore 內 slug 加權 */
  slugWeight: number;
  /** hybridScore 內門檻數字加權 */
  figureWeight: number;
  /** 最終分：base * (1-rrfBlend) + rrfNorm * rrfBlend */
  rrfBlend: number;
};

const DEFAULTS: RagHybridConfig = {
  enableVector: true,
  bm25Weight: 0.28,
  keywordWeight: 0.14,
  semanticWeight: 0.38,
  tierWeight: 0.08,
  slugWeight: 0.07,
  figureWeight: 0.05,
  rrfBlend: 0.35,
};

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envFlagDisabled(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** 讀取當前 Hybrid 設定（每次呼叫讀 env，便於測試／熱更新） */
export function getRagHybridConfig(): RagHybridConfig {
  const enableVector = !envFlagDisabled("RAG_DISABLE_VECTOR");
  return {
    enableVector,
    bm25Weight: envFloat("RAG_BM25_WEIGHT", DEFAULTS.bm25Weight),
    keywordWeight: envFloat("RAG_KEYWORD_WEIGHT", DEFAULTS.keywordWeight),
    semanticWeight: enableVector
      ? envFloat("RAG_SEMANTIC_WEIGHT", DEFAULTS.semanticWeight)
      : 0,
    tierWeight: envFloat("RAG_TIER_WEIGHT", DEFAULTS.tierWeight),
    slugWeight: envFloat("RAG_SLUG_WEIGHT", DEFAULTS.slugWeight),
    figureWeight: envFloat("RAG_FIGURE_WEIGHT", DEFAULTS.figureWeight),
    rrfBlend: enableVector ? envFloat("RAG_RRF_BLEND", DEFAULTS.rrfBlend) : 0,
  };
}

export function hybridConfigModeTag(cfg: RagHybridConfig): string {
  if (!cfg.enableVector) return "+hybrid=bm25-only";
  return `+hybrid=bm25+vector+rrf`;
}

export { DEFAULTS as RAG_HYBRID_DEFAULTS };
