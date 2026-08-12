/**
 * Faithfulness + Relevance + Citation Accuracy（FRC）統一評分。
 *
 * - Faithfulness／Relevance：沿用 metrics.ts（Ragas 風格啟發式）
 * - Citation Accuracy：條號命中＋來源命中＋[片段N] 標註（可選）
 */

import {
  scoreAnswerRelevance,
  scoreFaithfulness,
  mean,
} from "@/lib/rag-eval/metrics";
import { normalizeArticleToken } from "@/lib/rag-eval/compare-metrics";

export type FrcInput = {
  question: string;
  answer: string;
  contexts?: string[];
  mustInclude?: string[];
  relevanceKeywords?: string[];
  expectedArticles?: string[];
  expectedSources?: string[];
  /** answer／correct 題預設檢查是否出現 [片段N]；refuse 略過 */
  expectFragmentMarkers?: boolean;
  behavior?: "answer" | "correct" | "refuse";
};

export type CitationAccuracyBreakdown = {
  /** 綜合分數；無可評項目時為 null */
  score: number | null;
  /** 預期條號出現在答案中的比例 */
  article_hit: number | null;
  /** 預期來源 slug／名稱出現在答案中的比例 */
  source_hit: number | null;
  /** 是否出現至少一個 [片段N]（1／0）；不要求時為 null */
  fragment_marker: number | null;
};

export type FrcScore = {
  faithfulness: number;
  relevance: number;
  citation_accuracy: number | null;
  citation: CitationAccuracyBreakdown;
  /** 三指標可算者之平均（citation 為 null 時只平均 F+R） */
  frc_mean: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
}

function answerHasFragmentMarker(answer: string): boolean {
  return /\[\s*片段\s*\d+\s*\]|片段\s*\d+/.test(answer);
}

/**
 * Citation Accuracy ∈ [0,1] 或 null（無可評項目，如純 OOD 拒答）。
 *
 * 組成（有提供的子項等權平均）：
 * 1. article_hit：expected_articles 出現於答案
 * 2. source_hit：expected_sources 出現於答案（可選）
 * 3. fragment_marker：答案含 [片段N]／片段N（作答題建議開啟）
 */
export function scoreCitationAccuracyDetailed(params: {
  answer: string;
  expectedArticles?: string[];
  expectedSources?: string[];
  expectFragmentMarkers?: boolean;
  behavior?: "answer" | "correct" | "refuse";
}): CitationAccuracyBreakdown {
  const {
    answer,
    expectedArticles = [],
    expectedSources = [],
    behavior = "answer",
  } = params;

  if (behavior === "refuse" || answer.trim() === "非本主題的範圍") {
    return {
      score: null,
      article_hit: null,
      source_hit: null,
      fragment_marker: null,
    };
  }

  const compact = answer.replace(/\s+/g, "");

  let article_hit: number | null = null;
  if (expectedArticles.length > 0) {
    const hits = expectedArticles.filter((art) => {
      const n = normalizeArticleToken(art);
      return compact.includes(n) || compact.includes(art.replace(/\s+/g, ""));
    });
    article_hit = hits.length / expectedArticles.length;
  }

  let source_hit: number | null = null;
  if (expectedSources.length > 0) {
    const lower = answer.toLowerCase();
    const hits = expectedSources.filter((s) => {
      const key = s.toLowerCase();
      if (lower.includes(key)) return true;
      if (key.includes("government-procurement-act") && /政府採購法/.test(answer)) {
        return true;
      }
      if (key.includes("gpa-enforcement") && /施行細則/.test(answer)) return true;
      if (key.includes("threshold") && /門檻|公告金額|查核金額|小額/.test(answer)) {
        return true;
      }
      if (key.includes("below-threshold") && /未達公告|監辦辦法/.test(answer)) {
        return true;
      }
      if (key.includes("bidding-deadline") && /招標期限|等標期/.test(answer)) {
        return true;
      }
      if (key.includes("most-advantageous") && /最有利標/.test(answer)) return true;
      return false;
    });
    source_hit = hits.length / expectedSources.length;
  }

  const expectMarkers =
    params.expectFragmentMarkers ??
    (behavior === "answer" || behavior === "correct");
  let fragment_marker: number | null = null;
  if (expectMarkers) {
    const hasMarker = answerHasFragmentMarker(answer);
    const hasArticle = (article_hit ?? 0) > 0;
    fragment_marker = hasMarker ? 1 : hasArticle ? 0.5 : 0;
  }

  // 條號為 Citation 主訊號；來源為加分項；片段標註可選
  let score: number | null = null;
  if (article_hit != null && source_hit != null) {
    score = 0.85 * article_hit + 0.15 * source_hit;
  } else if (article_hit != null) {
    score = article_hit;
  } else if (source_hit != null) {
    score = source_hit;
  }
  if (score != null && fragment_marker != null) {
    score = 0.85 * score + 0.15 * fragment_marker;
  }

  return {
    score: score == null ? null : clamp01(score),
    article_hit,
    source_hit,
    fragment_marker,
  };
}

/** 精簡版：只回傳綜合 Citation Accuracy */
export function scoreCitationAccuracyFr(
  answer: string,
  expectedArticles: string[],
  opts?: {
    expectedSources?: string[];
    expectFragmentMarkers?: boolean;
    behavior?: "answer" | "correct" | "refuse";
  },
): number | null {
  return scoreCitationAccuracyDetailed({
    answer,
    expectedArticles,
    expectedSources: opts?.expectedSources,
    expectFragmentMarkers: opts?.expectFragmentMarkers,
    behavior: opts?.behavior,
  }).score;
}

/** 一次評完 Faithfulness、Relevance、Citation Accuracy */
export function scoreFRC(input: FrcInput): FrcScore {
  const contexts = input.contexts ?? [];
  const faithfulness = scoreFaithfulness({
    answer: input.answer,
    contexts,
    mustInclude: input.mustInclude,
  });
  const relevance = scoreAnswerRelevance({
    question: input.question,
    answer: input.answer,
    relevanceKeywords: input.relevanceKeywords,
  });
  const citation = scoreCitationAccuracyDetailed({
    answer: input.answer,
    expectedArticles: input.expectedArticles,
    expectedSources: input.expectedSources,
    expectFragmentMarkers: input.expectFragmentMarkers,
    behavior: input.behavior,
  });

  const forMean = [faithfulness, relevance];
  if (citation.score != null) forMean.push(citation.score);

  return {
    faithfulness,
    relevance,
    citation_accuracy: citation.score,
    citation,
    frc_mean: mean(forMean),
  };
}

export function formatFrcMarkdownTable(
  rows: Array<{
    id: string;
    category?: string;
    faithfulness: number;
    relevance: number;
    citation_accuracy: number | null;
    frc_mean: number;
  }>,
): string {
  const lines = [
    "| id | category | Faithfulness | Relevance | Citation | FRC mean |",
    "|----|----------|--------------|-----------|----------|----------|",
  ];
  for (const r of rows) {
    lines.push(
      `| \`${r.id}\` | ${r.category ?? "—"} | ${r.faithfulness} | ${r.relevance} | ${r.citation_accuracy ?? "—"} | ${r.frc_mean} |`,
    );
  }
  return lines.join("\n");
}
