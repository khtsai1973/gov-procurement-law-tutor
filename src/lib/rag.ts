import type { DocChunk, Regulation } from "@prisma/client";

import {
  amountTierExpansionTerms,
  isAmountTierClassificationQuery,
} from "@/lib/amount-tier";
import {
  awardMethodExpansionTerms,
  isAwardMethodPrincipleQuery,
} from "@/lib/award-method-principle";
import { isBelowThresholdSupervisionQuery } from "@/lib/below-threshold-supervision";
import { bm25Rank, buildBm25Index, reciprocalRankFusion } from "@/lib/bm25";
import { isCurrentThresholdFiguresQuery } from "@/lib/current-threshold-figures";
import {
  buildKnowledgeGraph,
  expandGraphNeighbors,
  graphExpandModeTag,
  type GraphChunkRef,
} from "@/lib/knowledge-graph";
import {
  isOpeningBidderCountQuery,
  openingBidderExpansionTerms,
} from "@/lib/opening-bidder-count";
import { isProcurementAmountDefinitionQuery } from "@/lib/procurement-amount-definition";
import { isSmallPurchaseThresholdQuery } from "@/lib/small-purchase-threshold";
import {
  canUseEmbeddings,
  cosineSimilarity,
  embedTexts,
  parseEmbedding,
} from "@/lib/embeddings";
import { prisma } from "@/lib/prisma";
import { keywordsForRetrieval } from "@/lib/concept-tags";
import { matchQuestionBank } from "@/lib/question-bank";
import type { QuestionBankMatch } from "@/lib/question-bank-types";
import { getRagHybridConfig, hybridConfigModeTag } from "@/lib/rag-hybrid-config";
import { rerankCandidates } from "@/lib/rerank";

/** 問答檢索僅限法規／函釋資料庫（不含題庫分類） */
const RAG_ALLOWED_TIERS = new Set(["LAW", "REGULATION", "ADMIN_RULE", "INTERPRETATION"]);

export type ChunkWithReg = DocChunk & { regulation: Regulation };

/** 期末報告／評測用檢索策略（生產預設 parent_contextual＋GraphRAG） */
export type RagStrategy = "baseline" | "contextual" | "parent_contextual";

export type RetrieveForRagOptions = {
  strategy?: RagStrategy;
  /** 比較實驗時可關閉 GraphRAG，避免與 Contextual 混淆 */
  enableGraph?: boolean;
};

function isParentChunk(c: Pick<DocChunk, "chunkRole">): boolean {
  return c.chunkRole === "PARENT";
}

function isChildChunk(c: Pick<DocChunk, "chunkRole">): boolean {
  return c.chunkRole !== "PARENT";
}

/**
 * 將 CHILD 命中依策略展開：
 * - baseline：僅回傳命中的 Child（無 Parent 展開、無細則擴充、無 Graph）
 * - contextual：保留 Child，並以條號擴充關聯施行細則 Parent
 * - parent_contextual：Child→Parent 展開＋細則擴充（可選 GraphRAG）
 */
export function applyRetrievalStrategy(params: {
  strategy: RagStrategy;
  childHits: ChunkWithReg[];
  byId: Map<string, ChunkWithReg>;
  allChunks: ChunkWithReg[];
  hasHierarchy: boolean;
  topK: number;
  enableGraph?: boolean;
}): { chunks: ChunkWithReg[]; strategyTags: string[]; graphAdded: number } {
  const {
    strategy,
    childHits,
    byId,
    allChunks,
    hasHierarchy,
    topK,
    enableGraph = false,
  } = params;

  if (strategy === "baseline" || !hasHierarchy) {
    return {
      chunks: childHits.slice(0, topK),
      strategyTags: ["+strategy=baseline"],
      graphAdded: 0,
    };
  }

  let chunks: ChunkWithReg[];
  const strategyTags: string[] = [];

  if (strategy === "contextual") {
    // 不展開母法 Parent，但做細則／關聯擴充（Contextual 查詢時擴展）
    chunks = enrichWithRelatedEnforcementParents(childHits, allChunks, 2);
    strategyTags.push("+strategy=contextual");
  } else {
    chunks = expandHitsToParentContext(childHits, byId);
    chunks = enrichWithRelatedEnforcementParents(chunks, allChunks, 2);
    strategyTags.push("+strategy=parent_contextual", "+parent-child");
  }

  let graphAdded = 0;
  if (enableGraph && strategy === "parent_contextual") {
    const parentNodes: GraphChunkRef[] = allChunks.filter(isParentChunk).map((c) => ({
      id: c.id,
      regulationSlug: c.regulation.slug,
      regulationTitle: c.regulation.title,
      tier: c.regulation.tier,
      articleKey: c.articleKey,
      content: c.content,
    }));
    const graph = buildKnowledgeGraph(parentNodes);
    const extras = expandGraphNeighbors(
      graph,
      chunks.map((c) => c.id),
      { maxExtra: 3 },
    );
    for (const ex of extras) {
      const full = byId.get(ex.id);
      if (!full || chunks.some((c) => c.id === full.id)) continue;
      chunks.push(full);
      graphAdded += 1;
    }
    const gtag = graphExpandModeTag(graphAdded);
    if (gtag) strategyTags.push(gtag);
  }

  return {
    chunks: chunks.slice(0, topK + 3),
    strategyTags,
    graphAdded,
  };
}

/**
 * 搜尋命中 CHILD 後，展開為 PARENT（完整條文上下文）。
 * 舊扁平資料（無 parentId／無 PARENT）則沿用命中片段本身。
 */
export function expandHitsToParentContext(
  hits: ChunkWithReg[],
  byId: Map<string, ChunkWithReg>,
): ChunkWithReg[] {
  const out: ChunkWithReg[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const parent = hit.parentId ? byId.get(hit.parentId) : undefined;
    const ctx = parent && isParentChunk(parent) ? parent : hit;
    if (seen.has(ctx.id)) continue;
    seen.add(ctx.id);
    out.push(ctx);
  }
  return out;
}

/**
 * Contextual RAG：母法條文命中時，嘗試附上施行細則中提及同條號的 Parent。
 */
export function enrichWithRelatedEnforcementParents(
  parents: ChunkWithReg[],
  allChunks: ChunkWithReg[],
  maxExtra = 2,
): ChunkWithReg[] {
  if (maxExtra <= 0) return parents;
  const allParents = allChunks.filter(isParentChunk);
  const out = [...parents];
  const seen = new Set(out.map((c) => c.id));
  let added = 0;

  for (const p of parents) {
    if (added >= maxExtra) break;
    if (p.regulation.slug !== "government-procurement-act") continue;
    const key = (p.articleKey ?? "").replace(/\s+/g, "");
    if (!key) continue;

    const related = allParents.find((c) => {
      if (seen.has(c.id)) return false;
      if (c.regulation.slug !== "gpa-enforcement-rules") return false;
      const body = c.content.replace(/\s+/g, "");
      return (
        body.includes(key) ||
        body.includes(`本法${key}`) ||
        body.includes(`採購法${key}`) ||
        (p.articleKey != null && c.content.includes(p.articleKey))
      );
    });
    if (!related) continue;
    seen.add(related.id);
    out.push(related);
    added += 1;
  }
  return out;
}

const STOP = new Set(
  "的 了 是 在 有 和 與 或 及 等 對 於 為 之 可 應 得 不得 要 會 可以 是否 何 哪 如何 什麼 幾 次 嗎 呢 吧".split(
    " ",
  ),
);

const QUERY_EXPANSIONS: Record<string, string[]> = {
  議價次數: ["議價", "比減價格", "減價", "限制性招標", "洽減", "協商"],
  議價: ["比減價格", "減價", "限制性招標"],
  金額級距: ["公告金額", "查核金額", "巨額採購", "採購金額", "小額採購", "金額門檻", "勞務", "工程", "財物"],
  金額門檻: ["公告金額", "查核金額", "巨額", "小額採購", "金額級距", "採購金額"],
  門檻: ["公告金額", "查核金額", "巨額", "金額門檻", "小額採購"],
  公告金額: ["查核金額", "巨額", "金額度級距", "採購金額", "金額門檻"],
  查核金額: ["公告金額", "巨額", "監辦", "金額度級距", "金額門檻"],
  巨額: ["查核金額", "公告金額", "採購金額", "金額門檻"],
  採購金額: ["公告金額", "查核金額", "巨額", "後續擴充", "選購", "金額門檻"],
  資訊服務: ["勞務", "公告金額", "查核金額", "巨額", "金額門檻", "第七條", "資訊服務廠商評選"],
  專業服務: ["勞務", "公告金額", "查核金額", "金額門檻", "第七條"],
  技術服務: ["勞務", "公告金額", "查核金額", "金額門檻", "第七條"],
  公開評選: ["限制性招標", "第二十二條", "公開客觀評選", "資訊服務", "專業服務", "技術服務", "開標", "家數", "三家", "一家"],
  限制性招標: ["公開評選", "第二十二條", "議價", "比價", "開標", "家數"],
  合格廠商: ["開標", "三家", "公開招標", "第四十八條", "施行細則", "公開評選"],
  開標: ["合格廠商", "三家", "公開招標", "限制性招標", "第四十八條", "流標"],
  等標期: ["招標期限", "招標期限標準", "截止投標", "公告金額", "查核金額", "巨額"],
  招標期限: ["等標期", "招標期限標準", "未達公告金額", "公告金額", "查核金額"],
  未達公告金額: ["小額採購", "公告金額", "公開取得報價單", "監辦", "招標辦法", "十分之一"],
  會同監辦: ["監辦", "未達公告金額", "十分之一", "主計", "開標", "驗收"],
  監辦: ["會同監辦", "未達公告金額", "十分之一", "主計"],
  評選委員會: ["採購評選委員會組織準則", "專家學者", "工作小組", "召集人", "評選"],
  最有利標: ["評選", "評選委員會", "最有利標評選辦法", "採購評選委員會組織準則", "第五十二條", "決標原則"],
  最低標: ["決標原則", "第五十二條", "最有利標", "底價", "複數決標"],
  決標原則: ["第五十二條", "最低標", "最有利標", "複數決標", "招標文件"],
};

const TIER_BOOST: Record<string, number> = {
  LAW: 4,
  REGULATION: 3,
  INTERPRETATION: 1,
  ADMIN_RULE: 0,
  QUESTION_BANK: 0,
};

const CORE_LAW_SLUGS = new Set(["government-procurement-act", "gpa-enforcement-rules"]);

/** 函釋／公告彙整：採購金額門檻數字查詢時優先 */
const THRESHOLD_INTERP_SLUGS = new Set(["pcc-procurement-amount-thresholds"]);

/** 金額分級相關 MOJ 命令（等標期、未達公告金額招標／監辦） */
const AMOUNT_TIER_REGULATION_SLUGS = new Set([
  "bidding-deadline-standards",
  "below-threshold-bidding-rules",
  "below-threshold-supervision-rules",
]);

/** 使用者明確問門檻數字（含查核／公告／巨額等用語）或級距歸類 */
const THRESHOLD_AMOUNT_QUERY =
  /查核金額|公告金額|巨額|金額門檻|金額級距|採購金額級距|小額採購|採購金額門檻|金額標準|多少錢|幾元|數字|NT\$|新臺幣|屬(於)?哪|落在哪|哪一個.*級距|哪一.*級距/;

function isThresholdAmountQuery(query: string): boolean {
  return THRESHOLD_AMOUNT_QUERY.test(query) || isAmountTierClassificationQuery(query);
}

function hasThresholdFigures(text: string): boolean {
  return /萬元|億元|NT\$|新臺幣\s*[\d一二三四五六七八九十百千]+/.test(text);
}

function ragFetchK(): number {
  const n = Number(process.env.RAG_FETCH_K ?? "40");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 80) : 40;
}

function ragTopK(): number {
  const n = Number(process.env.RAG_TOP_K ?? "8");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 16) : 8;
}

function ragMmrLambda(): number {
  const n = Number(process.env.RAG_MMR_LAMBDA ?? "0.65");
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.65;
}

function expandQuery(query: string, bank?: QuestionBankMatch): string {
  const compact = query.replace(/[^\p{L}\p{N}]/gu, "");
  const extras: string[] = [];
  for (const [key, terms] of Object.entries(QUERY_EXPANSIONS)) {
    if (compact.includes(key)) extras.push(...terms);
  }
  if (isThresholdAmountQuery(query)) {
    extras.push(...amountTierExpansionTerms(query));
  }
  if (isOpeningBidderCountQuery(query)) {
    extras.push(...openingBidderExpansionTerms(query));
  }
  if (isAwardMethodPrincipleQuery(query)) {
    extras.push(...awardMethodExpansionTerms(query));
  }
  // 題庫僅作關鍵詞擴展，不注入導引文字；過濾機械切塊，改以概念標籤為主
  if (bank) {
    const retrieval = keywordsForRetrieval({
      question: query,
      keywords: bank.keywords,
      max: 12,
    });
    if (retrieval.length) extras.push(...retrieval);
  }
  const unique = [...new Set(extras)];
  if (unique.length === 0) return query;
  return `${query}\n（相關關鍵詞：${unique.join("、")}）`;
}

function queryTerms(query: string, bank?: QuestionBankMatch): string[] {
  const terms = new Set<string>();
  const compact = query.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

  if (compact.length >= 2) terms.add(compact);

  if (bank?.keywords.length) {
    for (const kw of keywordsForRetrieval({ question: query, keywords: bank.keywords, max: 16 })) {
      terms.add(kw.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase());
    }
  }

  for (const [key, extras] of Object.entries(QUERY_EXPANSIONS)) {
    if (compact.includes(key)) {
      for (const e of extras) terms.add(e);
    }
  }

  for (const len of [2, 3, 4]) {
    for (let i = 0; i <= compact.length - len; i++) {
      const gram = compact.slice(i, i + len);
      if (!STOP.has(gram)) terms.add(gram);
    }
  }

  return [...terms];
}

function isStubChunk(text: string): boolean {
  return text.includes("占位內容") || text.includes("請將《");
}

function tierBoost(tier: string): number {
  return TIER_BOOST[tier] ?? 0;
}

function keywordScore(text: string, query: string, bank?: QuestionBankMatch): number {
  const terms = queryTerms(query, bank);
  if (terms.length === 0) return 0;

  const lower = text.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (lower.includes(t)) {
      score += t.length >= 3 ? 2 : 1;
    }
  }
  return score / terms.length;
}

function slugBoost(slug: string, query: string, bank?: QuestionBankMatch): number {
  let boost = 0;
  if (bank?.relatedSlugs.includes(slug)) boost += 5;
  if (isThresholdAmountQuery(query) && THRESHOLD_INTERP_SLUGS.has(slug)) {
    boost += 10;
  }
  if (
    (isThresholdAmountQuery(query) || /等標期|招標期限|未達公告/.test(query)) &&
    AMOUNT_TIER_REGULATION_SLUGS.has(slug)
  ) {
    boost += 4;
  }
  // 級距歸類常需先認定工程／財物／勞務（採購法第七條）
  if (
    isAmountTierClassificationQuery(query) &&
    slug === "government-procurement-act" &&
    /工程|財物|勞務|資訊服務|專業服務|技術服務/.test(query)
  ) {
    boost += 6;
  }
  if (/資訊服務/.test(query) && slug === "it-service-selection-billing-rules") {
    boost += 4;
  }
  if (
    isOpeningBidderCountQuery(query) &&
    (slug === "gpa-enforcement-rules" ||
      slug === "government-procurement-act" ||
      slug === "most-advantageous-tender-operations-manual")
  ) {
    boost += 6;
  }
  if (isBelowThresholdSupervisionQuery(query)) {
    if (slug === "below-threshold-supervision-rules") boost += 12;
    // 降低「公告金額以上會同監辦」辦法權重，避免答錯門檻
    if (slug === "joint-procurement-supervision-rules") boost -= 4;
  }
  if (isAwardMethodPrincipleQuery(query)) {
    if (slug === "government-procurement-act") boost += 10;
    if (
      slug === "most-advantageous-tender-operations-manual" ||
      slug === "most-advantageous-tender-selection-rules"
    ) {
      boost += 6;
    }
  }
  return boost;
}

function figureBoost(content: string, query: string): number {
  if (!isThresholdAmountQuery(query)) return 0;
  return hasThresholdFigures(content) ? 5 : 0;
}

function hybridScore(
  chunk: ChunkWithReg,
  query: string,
  semantic = 0,
  bank?: QuestionBankMatch,
  bm25 = 0,
): number {
  if (isStubChunk(chunk.content)) return 0;
  const cfg = getRagHybridConfig();
  const kw = keywordScore(chunk.content, query, bank);
  const slug = chunk.regulation.slug;
  const figures = hasThresholdFigures(chunk.content);
  const thresholdQ = isThresholdAmountQuery(query);
  const slugB = slugBoost(slug, query, bank);

  if (
    kw <= 0 &&
    semantic <= 0 &&
    bm25 <= 0 &&
    slugB <= 0 &&
    figureBoost(chunk.content, query) <= 0
  ) {
    return 0;
  }

  const tier =
    thresholdQ && !figures && !THRESHOLD_INTERP_SLUGS.has(slug)
      ? tierBoost(chunk.regulation.tier) * 0.25
      : tierBoost(chunk.regulation.tier);

  // Hybrid：BM25（關鍵字／條號）+ Dense Vector 語意 + 領域加權
  return (
    bm25 * cfg.bm25Weight +
    kw * cfg.keywordWeight +
    semantic * cfg.semanticWeight +
    tier * cfg.tierWeight +
    slugB * cfg.slugWeight +
    figureBoost(chunk.content, query) * cfg.figureWeight
  );
}

type ScoredChunk = {
  chunk: ChunkWithReg;
  score: number;
  vec: number[] | null;
  bm25: number;
  semantic: number;
};

function diversityPenalty(selected: ChunkWithReg[], candidate: ChunkWithReg, vec: number[] | null): number {
  let maxSim = 0;
  for (const sel of selected) {
    if (sel.regulationId === candidate.regulationId) {
      maxSim = Math.max(maxSim, 0.9);
    }
    // 同一 Parent 底下的多個 Child：視為高度重複
    if (sel.parentId && candidate.parentId && sel.parentId === candidate.parentId) {
      maxSim = Math.max(maxSim, 0.95);
    }
    const selVec = parseEmbedding(sel.embedding);
    if (selVec && vec) {
      maxSim = Math.max(maxSim, cosineSimilarity(selVec, vec));
    }
  }
  return maxSim;
}

/** MMR：在相關性與來源多樣性之間平衡，避免 8 段都來自同一法規 */
function mmrSelect(scored: ScoredChunk[], k: number, lambda: number): ChunkWithReg[] {
  const pool = scored.filter((s) => s.score > 0.08).sort((a, b) => b.score - a.score);
  const selected: ChunkWithReg[] = [];
  const remaining = [...pool];

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]!;
      const rel = item.score;
      const div = diversityPenalty(selected, item.chunk, item.vec);
      const mmr = lambda * rel - (1 - lambda) * div;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]!.chunk);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

async function scoreAllChunks(
  all: ChunkWithReg[],
  query: string,
  bank?: QuestionBankMatch,
): Promise<ScoredChunk[]> {
  const cfg = getRagHybridConfig();
  let queryVec: number[] | null = null;
  const expanded = expandQuery(query, bank);
  const useVector = cfg.enableVector && canUseEmbeddings();

  if (useVector) {
    try {
      const [vec] = await embedTexts([expanded]);
      queryVec = vec ?? null;
    } catch (e) {
      console.warn("[rag] query embedding failed:", e);
    }
  }

  const bm25Index = buildBm25Index(
    all.map((c) => ({ id: c.id, text: `${c.articleKey ?? ""}\n${c.content}` })),
  );
  const bm25Rows = bm25Rank(bm25Index, expanded);
  const bm25ById = new Map(bm25Rows.map((r) => [r.id, r.score]));
  const maxBm = Math.max(...bm25Rows.map((r) => r.score), 1e-9);

  // Dense Vector rank list（有 embedding 且未關閉向量時）
  const vectorRanked = useVector
    ? all
        .map((chunk) => {
          const vec = parseEmbedding(chunk.embedding);
          const sem = queryVec && vec ? cosineSimilarity(queryVec, vec) : 0;
          return { id: chunk.id, score: sem, vec, sem };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
    : [];

  const rrfLists =
    vectorRanked.length > 0
      ? [bm25Rows.map((r) => ({ id: r.id })), vectorRanked.map((r) => ({ id: r.id }))]
      : [bm25Rows.map((r) => ({ id: r.id }))];
  const rrf = reciprocalRankFusion(rrfLists);
  const maxRrf = Math.max(...[...rrf.values()], 1e-9);
  const baseBlend = 1 - cfg.rrfBlend;

  return all.map((chunk) => {
    const vec = parseEmbedding(chunk.embedding);
    const semantic =
      useVector && queryVec && vec ? cosineSimilarity(queryVec, vec) : 0;
    const bm25Raw = bm25ById.get(chunk.id) ?? 0;
    const bm25 = bm25Raw / maxBm;
    const rrfNorm = (rrf.get(chunk.id) ?? 0) / maxRrf;
    const base = hybridScore(chunk, query, semantic, bank, bm25);
    return {
      chunk,
      // RRF 混合分與加權分融合
      score: base * baseBlend + rrfNorm * cfg.rrfBlend,
      vec,
      bm25,
      semantic,
    };
  });
}

const PREFER_CORE_LAW =
  /議價|比減|減價|限制性招標|協商|底價|公告金額|查核金額|巨額|金額級距|金額門檻|小額採購|採購金額|後續擴充|公開評選|開標|合格廠商|幾家/;

/**
 * RAG 檢索：擴展查詢 → BM25 + Vector（RRF）→ BGE 風格 Re-rank
 * → MMR →（依 strategy）Parent／Contextual／GraphRAG
 *
 * 預設 strategy=`parent_contextual` 且 enableGraph=true（與既有生產行為一致）。
 */
export async function retrieveForRag(
  query: string,
  topK = ragTopK(),
  options?: RetrieveForRagOptions,
): Promise<{ chunks: ChunkWithReg[]; mode: string; questionBankUsed?: boolean }> {
  const strategy: RagStrategy = options?.strategy ?? "parent_contextual";
  const enableGraph = options?.enableGraph ?? strategy === "parent_contextual";
  const { ensureDocChunkHierarchySchema } = await import(
    "@/lib/ensure-doc-chunk-hierarchy-schema"
  );
  await ensureDocChunkHierarchySchema().catch((e) => {
    console.warn("[rag] ensureDocChunkHierarchySchema:", e);
  });

  const loaded = await prisma.docChunk.findMany({
    include: { regulation: true },
  });
  const all = loaded.filter((c) => RAG_ALLOWED_TIERS.has(c.regulation.tier));
  const byId = new Map(all.map((c) => [c.id, c]));
  const hasHierarchy = all.some(isParentChunk);
  const searchable = hasHierarchy ? all.filter(isChildChunk) : all;

  if (searchable.length === 0) {
    return { chunks: [], mode: "empty" };
  }

  const poolSize = Math.max(topK * 3, ragFetchK());
  const thresholdQ = isThresholdAmountQuery(query);
  const classifyQ = isAmountTierClassificationQuery(query);
  const bidderCountQ = isOpeningBidderCountQuery(query);
  const amountTierQ = thresholdQ || /等標期|招標期限|未達公告金額/.test(query);

  const corpus = amountTierQ
    ? searchable.filter(
        (c) =>
          THRESHOLD_INTERP_SLUGS.has(c.regulation.slug) ||
          AMOUNT_TIER_REGULATION_SLUGS.has(c.regulation.slug) ||
          hasThresholdFigures(c.content) ||
          (CORE_LAW_SLUGS.has(c.regulation.slug) &&
            /查核金額|公告金額|巨額|小額採購|等標期|招標期限|本法所稱工程|本法所稱財物|本法所稱勞務|資訊服務/.test(
              c.content,
            )) ||
          (classifyQ &&
            (c.regulation.slug === "it-service-selection-billing-rules" ||
              /資訊服務|專業服務|技術服務/.test(c.content))),
      )
    : bidderCountQ
      ? searchable.filter(
          (c) =>
            CORE_LAW_SLUGS.has(c.regulation.slug) ||
            c.regulation.slug === "most-advantageous-tender-operations-manual" ||
            c.regulation.slug === "most-advantageous-tender-selection-rules" ||
            c.regulation.slug === "it-service-selection-billing-rules" ||
            /三家|開標|合格廠商|公開評選|限制性招標|第四十八|第二十二/.test(c.content),
        )
      : PREFER_CORE_LAW.test(query)
        ? searchable.filter(
            (c) =>
              c.regulation.tier === "LAW" ||
              c.regulation.tier === "REGULATION" ||
              CORE_LAW_SLUGS.has(c.regulation.slug) ||
              THRESHOLD_INTERP_SLUGS.has(c.regulation.slug) ||
              c.regulation.slug === "most-advantageous-tender-operations-manual",
          )
        : searchable;

  const baseCorpus = corpus.length > 0 ? corpus : searchable;

  let scored = await scoreAllChunks(baseCorpus, query, undefined);
  scored.sort((a, b) => b.score - a.score);
  let hasSignal = scored.some((s) => s.score > 0.1);
  const topScore = scored[0]?.score ?? 0;

  let questionBankUsed = false;
  if (!hasSignal || topScore < 0.15) {
    const bank = await matchQuestionBank(query);
    if (bank) {
      questionBankUsed = true;
      scored = await scoreAllChunks(baseCorpus, query, bank);
      scored.sort((a, b) => b.score - a.score);
      hasSignal = scored.some((s) => s.score > 0.1);
    }
  }

  if (!hasSignal) {
    const weakChildren = scored.filter((s) => s.score > 0.06).slice(0, topK).map((s) => s.chunk);
    if (weakChildren.length > 0) {
      const appliedWeak = applyRetrievalStrategy({
        strategy,
        childHits: weakChildren,
        byId,
        allChunks: all,
        hasHierarchy,
        topK,
        enableGraph,
      });
      const hybridTag = hybridConfigModeTag(getRagHybridConfig());
      return {
        chunks: appliedWeak.chunks,
        mode: questionBankUsed
          ? `rag-weak-match+keyword-expand${hybridTag}${appliedWeak.strategyTags.join("")}`
          : `rag-weak-match${hybridTag}${appliedWeak.strategyTags.join("")}`,
        questionBankUsed,
      };
    }
    return {
      chunks: [],
      mode: questionBankUsed ? "no-match+keyword-expand" : "no-match",
      questionBankUsed,
    };
  }

  const preRerank = scored.slice(0, Math.min(poolSize, 32));
  const { results: reranked, mode: rerankMode } = await rerankCandidates(
    expandQuery(query),
    preRerank.map((s) => ({
      id: s.chunk.id,
      text: s.chunk.content,
      semantic: s.semantic,
      articleKey: s.chunk.articleKey,
    })),
    poolSize,
  );
  const byIdScore = new Map(preRerank.map((s) => [s.chunk.id, s]));
  const rerankScored: ScoredChunk[] = reranked
    .map((r) => {
      const base = byIdScore.get(r.id);
      if (!base) return null;
      return { ...base, score: r.score * 0.7 + base.score * 0.3 };
    })
    .filter((x): x is ScoredChunk => Boolean(x));

  const candidates = (rerankScored.length > 0 ? rerankScored : scored).slice(0, poolSize);
  let childHits = mmrSelect(candidates, topK, ragMmrLambda());

  if (thresholdQ && !childHits.some((c) => THRESHOLD_INTERP_SLUGS.has(c.regulation.slug))) {
    const bestInterp = scored.find((s) => THRESHOLD_INTERP_SLUGS.has(s.chunk.regulation.slug));
    if (bestInterp && childHits.length > 0) {
      childHits = [bestInterp.chunk, ...childHits.slice(0, topK - 1)];
    } else if (bestInterp) {
      childHits = [bestInterp.chunk];
    }
  }

  if (classifyQ) {
    const ensureSlug = (slug: string, contentTest?: RegExp) => {
      if (childHits.some((c) => c.regulation.slug === slug && (!contentTest || contentTest.test(c.content)))) {
        return;
      }
      const hit = scored.find(
        (s) =>
          s.chunk.regulation.slug === slug &&
          (!contentTest || contentTest.test(s.chunk.content)),
      );
      if (!hit) return;
      childHits = [hit.chunk, ...childHits.filter((c) => c.id !== hit.chunk.id)].slice(0, topK);
    };
    ensureSlug("pcc-procurement-amount-thresholds");
    ensureSlug("government-procurement-act", /本法所稱勞務|本法所稱工程|本法所稱財物|資訊服務/);
  }

  if (bidderCountQ) {
    const ensureSlug = (slug: string, contentTest?: RegExp) => {
      if (childHits.some((c) => c.regulation.slug === slug && (!contentTest || contentTest.test(c.content)))) {
        return;
      }
      const hit = scored.find(
        (s) =>
          s.chunk.regulation.slug === slug &&
          (!contentTest || contentTest.test(s.chunk.content)),
      );
      if (!hit) return;
      childHits = [hit.chunk, ...childHits.filter((c) => c.id !== hit.chunk.id)].slice(0, topK);
    };
    ensureSlug("gpa-enforcement-rules", /三家以上合格廠商|公開招標/);
    ensureSlug("government-procurement-act", /第 48 條|三家以上合格廠商|限制性招標/);
    ensureSlug("most-advantageous-tender-operations-manual", /公開評選|家數|三家/);
  }

  const ensureSlug = (slug: string, contentTest?: RegExp) => {
    if (childHits.some((c) => c.regulation.slug === slug && (!contentTest || contentTest.test(c.content)))) {
      return;
    }
    const hit = scored.find(
      (s) =>
        s.chunk.regulation.slug === slug &&
        (!contentTest || contentTest.test(s.chunk.content)),
    );
    if (!hit) return;
    childHits = [hit.chunk, ...childHits.filter((c) => c.id !== hit.chunk.id)].slice(0, topK);
  };

  if (isBelowThresholdSupervisionQuery(query)) {
    ensureSlug("below-threshold-supervision-rules", /十分之一|監辦/);
  }
  if (isCurrentThresholdFiguresQuery(query) || isSmallPurchaseThresholdQuery(query)) {
    ensureSlug("pcc-procurement-amount-thresholds");
  }
  if (isProcurementAmountDefinitionQuery(query)) {
    ensureSlug("gpa-enforcement-rules", /第 6 條|選購或後續擴充|招標前認定/);
  }
  if (isAwardMethodPrincipleQuery(query)) {
    ensureSlug("government-procurement-act", /第 52 條|最有利標為原則|決標.*原則之一/);
    ensureSlug("most-advantageous-tender-operations-manual", /第52條|最有利標決標|不論採購金額/);
  }

  const applied = applyRetrievalStrategy({
    strategy,
    childHits,
    byId,
    allChunks: all,
    hasHierarchy,
    topK,
    enableGraph,
  });
  const chunks = applied.chunks;

  const hybridCfg = getRagHybridConfig();
  const modeBase =
    hybridCfg.enableVector &&
    canUseEmbeddings() &&
    searchable.some((c) => parseEmbedding(c.embedding))
      ? "rag-bm25-vector-rrf"
      : "rag-bm25";
  const hybridTag = hybridConfigModeTag(hybridCfg);
  const rerankTag = `+${rerankMode}`;
  const strategyTag = applied.strategyTags.join("");
  // 無階層時 baseline 標籤已含於 strategyTags；保留相容舊字串的 parent-child 語意
  const legacyHierarchy =
    hasHierarchy && strategy === "parent_contextual" && !strategyTag.includes("+parent-child")
      ? "+parent-child"
      : "";

  return {
    chunks,
    mode: questionBankUsed
      ? `${modeBase}${hybridTag}${rerankTag}+keyword-expand${strategyTag}${legacyHierarchy}`
      : `${modeBase}${hybridTag}${rerankTag}${strategyTag}${legacyHierarchy}`,
    questionBankUsed,
  };
}

/** 相容舊 API */
export async function retrieveChunks(query: string, take: number): Promise<ChunkWithReg[]> {
  const { chunks } = await retrieveForRag(query, take);
  return chunks;
}

/** 供 LLM 使用的上下文（Parent 完整條文／背景） */
export function formatRagContext(chunks: ChunkWithReg[]): string {
  return chunks
    .map((c, i) => {
      const article =
        c.articleKey ??
        c.content.match(/^###\s*(第[\d\-]+\s*條)/m)?.[1] ??
        c.content.match(/條號：\s*(第\s*[\d\-]+\s*條)/)?.[1];
      const role = isParentChunk(c) ? "完整條文" : "片段";
      const label = article
        ? `${c.regulation.title}｜${article}｜${role}`
        : `${c.regulation.title}｜${role}`;
      return `【片段${i + 1}｜${label}】\n${c.content}`;
    })
    .join("\n\n---\n\n");
}
