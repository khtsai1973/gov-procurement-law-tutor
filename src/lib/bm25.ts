/**
 * Okapi BM25（繁中字元 n-gram 切詞）— 強化條號／關鍵字精準檢索。
 */

export type Bm25Doc = { id: string; text: string };

const STOP = new Set(
  "的了是在有和與或及等對於為之可應得不得要會可以是否何哪如何什麼幾次嗎呢吧".split(""),
);

/** 繁中：2～3 字元 gram + 連續數字／條號片段 */
export function tokenizeZh(text: string): string[] {
  const compact = text.replace(/\s+/g, "").toLowerCase();
  const tokens: string[] = [];
  const seen = new Set<string>();

  const push = (t: string) => {
    if (!t || STOP.has(t) || seen.has(t)) return;
    seen.add(t);
    tokens.push(t);
  };

  for (const m of compact.matchAll(/第\d{1,3}條(?:第\d+項)?(?:第\d+款)?/g)) {
    push(m[0]!);
  }
  for (const m of compact.matchAll(/\d{2,}/g)) {
    push(m[0]!);
  }

  for (const len of [2, 3]) {
    for (let i = 0; i <= compact.length - len; i++) {
      push(compact.slice(i, i + len));
    }
  }
  return tokens;
}

export type Bm25Index = {
  N: number;
  avgdl: number;
  df: Map<string, number>;
  tf: Map<string, Map<string, number>>; // docId → term → tf
  dl: Map<string, number>;
};

export function buildBm25Index(docs: Bm25Doc[]): Bm25Index {
  const df = new Map<string, number>();
  const tf = new Map<string, Map<string, number>>();
  const dl = new Map<string, number>();
  let totalLen = 0;

  for (const doc of docs) {
    const terms = tokenizeZh(doc.text);
    dl.set(doc.id, terms.length);
    totalLen += terms.length;
    const counts = new Map<string, number>();
    for (const t of terms) counts.set(t, (counts.get(t) ?? 0) + 1);
    tf.set(doc.id, counts);
    for (const t of counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }

  return {
    N: docs.length,
    avgdl: docs.length ? totalLen / docs.length : 0,
    df,
    tf,
    dl,
  };
}

/** Okapi BM25 score；k1=1.2, b=0.75 */
export function bm25Score(
  index: Bm25Index,
  docId: string,
  query: string,
  k1 = 1.2,
  b = 0.75,
): number {
  const qTerms = tokenizeZh(query);
  if (qTerms.length === 0 || index.N === 0) return 0;
  const docTf = index.tf.get(docId);
  if (!docTf) return 0;
  const docLen = index.dl.get(docId) ?? 0;
  let score = 0;
  const seenQ = new Set<string>();
  for (const term of qTerms) {
    if (seenQ.has(term)) continue;
    seenQ.add(term);
    const f = docTf.get(term) ?? 0;
    if (f <= 0) continue;
    const n = index.df.get(term) ?? 0;
    const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
    const denom = f + k1 * (1 - b + b * (docLen / (index.avgdl || 1)));
    score += idf * ((f * (k1 + 1)) / denom);
  }
  return score;
}

/** 回傳依 BM25 分數排序的 (id, score) */
export function bm25Rank(
  index: Bm25Index,
  query: string,
): Array<{ id: string; score: number }> {
  const rows: Array<{ id: string; score: number }> = [];
  for (const id of index.tf.keys()) {
    const score = bm25Score(index, id, query);
    if (score > 0) rows.push({ id, score });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

/**
 * Reciprocal Rank Fusion：合併多路排序。
 * score = Σ 1 / (k + rank)
 */
export function reciprocalRankFusion(
  rankedLists: Array<Array<{ id: string }>>,
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((row, idx) => {
      const add = 1 / (k + idx + 1);
      scores.set(row.id, (scores.get(row.id) ?? 0) + add);
    });
  }
  return scores;
}
