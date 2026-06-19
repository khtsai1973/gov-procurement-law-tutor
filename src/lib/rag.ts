import type { DocChunk, Regulation } from "@prisma/client";

import {
  canUseEmbeddings,
  cosineSimilarity,
  embedTexts,
  parseEmbedding,
} from "@/lib/embeddings";
import { prisma } from "@/lib/prisma";
import { matchQuestionBank } from "@/lib/question-bank";
import type { QuestionBankMatch } from "@/lib/question-bank-types";

export type ChunkWithReg = DocChunk & { regulation: Regulation };

const STOP = new Set(
  "的 了 是 在 有 和 與 或 及 等 對 於 為 之 可 應 得 不得 要 會 可以 是否 何 哪 如何 什麼 幾 次 嗎 呢 吧".split(
    " ",
  ),
);

const QUERY_EXPANSIONS: Record<string, string[]> = {
  議價次數: ["議價", "比減價格", "減價", "限制性招標", "洽減", "協商"],
  議價: ["比減價格", "減價", "限制性招標"],
  金額級距: ["公告金額", "查核金額", "巨額採購", "採購金額", "小額採購", "金額門檻"],
  金額門檻: ["公告金額", "查核金額", "巨額", "小額採購", "金額級距", "採購金額"],
  門檻: ["公告金額", "查核金額", "巨額", "金額門檻", "小額採購"],
  公告金額: ["查核金額", "巨額", "金額度級距", "採購金額", "金額門檻"],
  查核金額: ["公告金額", "巨額", "監辦", "金額度級距", "金額門檻"],
  巨額: ["查核金額", "公告金額", "採購金額", "金額門檻"],
  採購金額: ["公告金額", "查核金額", "巨額", "後續擴充", "選購", "金額門檻"],
  等標期: ["招標期限", "招標期限標準", "截止投標", "公告金額", "查核金額", "巨額"],
  招標期限: ["等標期", "招標期限標準", "未達公告金額", "公告金額", "查核金額"],
  未達公告金額: ["小額採購", "公告金額", "公開取得報價單", "監辦", "招標辦法"],
  評選委員會: ["採購評選委員會組織準則", "專家學者", "工作小組", "召集人", "評選"],
  最有利標: ["評選", "評選委員會", "最有利標評選辦法", "採購評選委員會組織準則"],
};

const TIER_BOOST: Record<string, number> = {
  LAW: 4,
  REGULATION: 3,
  INTERPRETATION: 1,
  ADMIN_RULE: 0,
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

/** 使用者明確問門檻數字（含查核／公告／巨額等用語） */
const THRESHOLD_AMOUNT_QUERY =
  /查核金額|公告金額|巨額|金額門檻|金額級距|小額採購|採購金額門檻|金額標準|多少錢|幾元|數字|NT\$|新臺幣/;

function isThresholdAmountQuery(query: string): boolean {
  return THRESHOLD_AMOUNT_QUERY.test(query);
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
  if (bank?.keywords.length) extras.push(...bank.keywords);
  const unique = [...new Set(extras)];
  if (unique.length === 0 && !bank?.hintAnswer) return query;
  const parts = [query];
  if (unique.length > 0) parts.push(`（相關關鍵詞：${unique.join("、")}）`);
  if (bank?.hintAnswer) parts.push(`（題庫導引：${bank.hintAnswer}）`);
  return parts.join("\n");
}

function queryTerms(query: string, bank?: QuestionBankMatch): string[] {
  const terms = new Set<string>();
  const compact = query.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

  if (compact.length >= 2) terms.add(compact);

  if (bank?.keywords.length) {
    for (const kw of bank.keywords) terms.add(kw.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase());
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
    boost += 8;
  }
  if (
    (isThresholdAmountQuery(query) || /等標期|招標期限|未達公告/.test(query)) &&
    AMOUNT_TIER_REGULATION_SLUGS.has(slug)
  ) {
    boost += 4;
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
): number {
  if (isStubChunk(chunk.content)) return 0;
  const kw = keywordScore(chunk.content, query, bank);
  const slug = chunk.regulation.slug;
  const figures = hasThresholdFigures(chunk.content);
  const thresholdQ = isThresholdAmountQuery(query);
  const slugB = slugBoost(slug, query, bank);

  if (kw <= 0 && semantic <= 0 && slugB <= 0 && figureBoost(chunk.content, query) <= 0) {
    return 0;
  }

  const tier =
    thresholdQ && !figures && !THRESHOLD_INTERP_SLUGS.has(slug)
      ? tierBoost(chunk.regulation.tier) * 0.25
      : tierBoost(chunk.regulation.tier);

  return (
    kw * 0.32 +
    semantic * 0.48 +
    tier * 0.08 +
    slugB * 0.07 +
    figureBoost(chunk.content, query) * 0.05
  );
}

type ScoredChunk = {
  chunk: ChunkWithReg;
  score: number;
  vec: number[] | null;
};

function diversityPenalty(selected: ChunkWithReg[], candidate: ChunkWithReg, vec: number[] | null): number {
  let maxSim = 0;
  for (const sel of selected) {
    if (sel.regulationId === candidate.regulationId) {
      maxSim = Math.max(maxSim, 0.9);
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
  let queryVec: number[] | null = null;

  if (canUseEmbeddings()) {
    try {
      const [vec] = await embedTexts([expandQuery(query, bank)]);
      queryVec = vec ?? null;
    } catch (e) {
      console.warn("[rag] query embedding failed:", e);
    }
  }

  return all.map((chunk) => {
    const vec = parseEmbedding(chunk.embedding);
    const sem = queryVec && vec ? cosineSimilarity(queryVec, vec) : 0;
    return {
      chunk,
      score: hybridScore(chunk, query, sem, bank),
      vec,
    };
  });
}

const PREFER_CORE_LAW =
  /議價|比減|減價|限制性招標|協商|底價|公告金額|查核金額|巨額|金額級距|金額門檻|小額採購|採購金額|後續擴充/;

/**
 * RAG 檢索：擴展查詢 → 混合向量+關鍵字打分 → 取較大候選池 → MMR 多樣化 → 回傳 topK 片段
 */
export async function retrieveForRag(
  query: string,
  topK = ragTopK(),
): Promise<{ chunks: ChunkWithReg[]; mode: string; questionBankUsed?: boolean }> {
  const all = await prisma.docChunk.findMany({
    include: { regulation: true },
  });

  if (all.length === 0) {
    return { chunks: [], mode: "empty" };
  }

  const poolSize = Math.max(topK * 3, ragFetchK());
  const thresholdQ = isThresholdAmountQuery(query);

  const amountTierQ = thresholdQ || /等標期|招標期限|未達公告金額/.test(query);

  const corpus = amountTierQ
    ? all.filter(
        (c) =>
          THRESHOLD_INTERP_SLUGS.has(c.regulation.slug) ||
          AMOUNT_TIER_REGULATION_SLUGS.has(c.regulation.slug) ||
          hasThresholdFigures(c.content) ||
          (CORE_LAW_SLUGS.has(c.regulation.slug) &&
            /查核金額|公告金額|巨額|小額採購|等標期|招標期限/.test(c.content)),
      )
    : PREFER_CORE_LAW.test(query)
      ? all.filter(
          (c) =>
            c.regulation.tier === "LAW" ||
            c.regulation.tier === "REGULATION" ||
            CORE_LAW_SLUGS.has(c.regulation.slug) ||
            THRESHOLD_INTERP_SLUGS.has(c.regulation.slug),
        )
      : all;

  const baseCorpus = corpus.length > 0 ? corpus : all;

  // 1) 先自法規／函釋清單檢索（不加題庫）
  let scored = await scoreAllChunks(baseCorpus, query, undefined);
  scored.sort((a, b) => b.score - a.score);
  let hasSignal = scored.some((s) => s.score > 0.1);
  const topScore = scored[0]?.score ?? 0;

  // 2) 不足以直接作答時，再以題庫輔助擴展檢索
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
    const weak = scored.filter((s) => s.score > 0.06).slice(0, topK);
    if (weak.length > 0) {
      return {
        chunks: weak.map((s) => s.chunk),
        mode: questionBankUsed ? "rag-weak-match+question-bank" : "rag-weak-match",
        questionBankUsed,
      };
    }
    return {
      chunks: [],
      mode: questionBankUsed ? "no-match+question-bank" : "no-match",
      questionBankUsed,
    };
  }

  const candidates = scored.slice(0, poolSize);
  let chunks = mmrSelect(candidates, topK, ragMmrLambda());

  if (thresholdQ && !chunks.some((c) => THRESHOLD_INTERP_SLUGS.has(c.regulation.slug))) {
    const bestInterp = scored.find((s) => THRESHOLD_INTERP_SLUGS.has(s.chunk.regulation.slug));
    if (bestInterp && chunks.length > 0) {
      chunks = [bestInterp.chunk, ...chunks.slice(0, topK - 1)];
    } else if (bestInterp) {
      chunks = [bestInterp.chunk];
    }
  }

  const modeBase =
    canUseEmbeddings() && all.some((c) => parseEmbedding(c.embedding))
      ? "rag-hybrid-mmr"
      : "rag-keyword-mmr";

  return {
    chunks,
    mode: questionBankUsed ? `${modeBase}+question-bank` : modeBase,
    questionBankUsed,
  };
}

/** 相容舊 API */
export async function retrieveChunks(query: string, take: number): Promise<ChunkWithReg[]> {
  const { chunks } = await retrieveForRag(query, take);
  return chunks;
}

/** 供 LLM 使用的上下文（含條號提示） */
export function formatRagContext(chunks: ChunkWithReg[]): string {
  return chunks
    .map((c, i) => {
      const article = c.content.match(/^###\s*(第[\d\-]+\s*條)/m)?.[1];
      const label = article ? `${c.regulation.title}｜${article}` : c.regulation.title;
      return `【片段${i + 1}｜${label}】\n${c.content}`;
    })
    .join("\n\n---\n\n");
}
