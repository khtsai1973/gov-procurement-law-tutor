/**
 * RAG 策略比較指標：Citation Accuracy、Retrieval Hit Rate、Latency 分位。
 */

export function normalizeArticleToken(raw: string): string {
  const m = raw.replace(/\s+/g, "").match(/第(\d{1,3})條/);
  return m ? `第${m[1]}條` : raw.replace(/\s+/g, "");
}

/** 答案文字是否命中預期條號 */
export function scoreCitationAccuracy(
  answer: string,
  expectedArticles: string[],
): number | null {
  if (!expectedArticles.length) return null;
  const a = answer.replace(/\s+/g, "");
  const hits = expectedArticles.filter((art) => {
    const n = normalizeArticleToken(art);
    return a.includes(n) || a.includes(art.replace(/\s+/g, ""));
  });
  return hits.length / expectedArticles.length;
}

export type RetrievedRef = {
  slug?: string | null;
  title?: string | null;
  articleKey?: string | null;
  content?: string | null;
};

/**
 * Retrieval Hit Rate：預期來源 slug／條號是否出現在檢索結果。
 * 同時有 sources 與 articles 時取平均；僅一方則用該方。
 */
export function scoreRetrievalHitRate(params: {
  retrieved: RetrievedRef[];
  expectedSources: string[];
  expectedArticles: string[];
}): number | null {
  const { retrieved, expectedSources, expectedArticles } = params;
  if (!expectedSources.length && !expectedArticles.length) return null;
  if (retrieved.length === 0) return 0;

  const slugBlob = retrieved
    .map((r) => `${r.slug ?? ""} ${r.title ?? ""}`)
    .join("\n")
    .toLowerCase();
  const articleBlob = retrieved
    .map((r) => `${r.articleKey ?? ""} ${r.content ?? ""}`)
    .join("\n")
    .replace(/\s+/g, "");

  let sourceHit: number | null = null;
  if (expectedSources.length) {
    const hits = expectedSources.filter((s) => {
      const key = s.toLowerCase();
      return slugBlob.includes(key);
    });
    sourceHit = hits.length / expectedSources.length;
  }

  let articleHit: number | null = null;
  if (expectedArticles.length) {
    const hits = expectedArticles.filter((art) => {
      const n = normalizeArticleToken(art);
      return articleBlob.includes(n);
    });
    articleHit = hits.length / expectedArticles.length;
  }

  if (sourceHit != null && articleHit != null) return (sourceHit + articleHit) / 2;
  return sourceHit ?? articleHit;
}

export function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}

export function latencySummary(samplesMs: number[]): {
  n: number;
  mean: number | null;
  p50: number | null;
  p95: number | null;
} {
  if (samplesMs.length === 0) {
    return { n: 0, mean: null, p50: null, p95: null };
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const mean =
    Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 1000) / 1000;
  return {
    n: sorted.length,
    mean,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}
