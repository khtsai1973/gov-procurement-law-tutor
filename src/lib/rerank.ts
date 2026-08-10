/**
 * Re-ranker：預設為本地 BGE 風格特徵融合；
 * 若設定 BGE_RERANKER_URL（或 HF Inference），可呼叫遠端 BGE-Reranker。
 */

import { cosineSimilarity } from "@/lib/embeddings";
import { bm25Score, buildBm25Index, tokenizeZh, type Bm25Index } from "@/lib/bm25";

export type RerankCandidate = {
  id: string;
  text: string;
  /** 預計算 query–doc 餘弦（可選） */
  semantic?: number;
  articleKey?: string | null;
};

export type RerankResult = {
  id: string;
  score: number;
};

function articleBonus(query: string, articleKey: string | null | undefined): number {
  if (!articleKey) return 0;
  const q = query.replace(/\s+/g, "");
  const key = articleKey.replace(/\s+/g, "");
  if (!key) return 0;
  if (q.includes(key) || q.includes(key.replace(/^第/, ""))) return 0.35;
  const num = key.match(/\d+/)?.[0];
  if (num && (q.includes(`第${num}條`) || q.includes(`${num}條`))) return 0.35;
  return 0;
}

function phraseBonus(query: string, text: string): number {
  const compactQ = query.replace(/\s+/g, "");
  const compactT = text.replace(/\s+/g, "");
  if (compactQ.length >= 4 && compactT.includes(compactQ.slice(0, Math.min(12, compactQ.length)))) {
    return 0.2;
  }
  const terms = tokenizeZh(query).filter((t) => t.length >= 2).slice(0, 8);
  if (terms.length === 0) return 0;
  let hit = 0;
  for (const t of terms) if (compactT.includes(t)) hit += 1;
  return (hit / terms.length) * 0.15;
}

/** 本地 BGE 風格：語意 + BM25 正規化 + 條號／片語加權（無需外部模型） */
export function localBgeStyleRerank(
  query: string,
  candidates: RerankCandidate[],
  opts?: { bm25Index?: Bm25Index },
): RerankResult[] {
  if (candidates.length === 0) return [];
  const index =
    opts?.bm25Index ??
    buildBm25Index(candidates.map((c) => ({ id: c.id, text: c.text })));

  const bm25Raw = candidates.map((c) => bm25Score(index, c.id, query));
  const maxBm = Math.max(...bm25Raw, 1e-9);

  const scored = candidates.map((c, i) => {
    const sem = Math.max(0, c.semantic ?? 0);
    const bm = bm25Raw[i]! / maxBm;
    const score =
      0.45 * sem +
      0.35 * bm +
      articleBonus(query, c.articleKey) +
      phraseBonus(query, c.text);
    return { id: c.id, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

type RemoteRerankRow = { index: number; score: number };

async function remoteBgeRerank(
  query: string,
  texts: string[],
): Promise<RemoteRerankRow[] | null> {
  const url = process.env.BGE_RERANKER_URL?.trim();
  const hfToken = process.env.HF_API_TOKEN?.trim() || process.env.HUGGINGFACE_API_KEY?.trim();
  if (!url && !hfToken) return null;

  try {
    if (url) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, documents: texts }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { results?: RemoteRerankRow[] } | RemoteRerankRow[];
      const rows = Array.isArray(data) ? data : data.results;
      return Array.isArray(rows) ? rows : null;
    }

    // Hugging Face Inference（BAAI/bge-reranker-v2-m3 相容：pairs）
    const model = process.env.BGE_RERANKER_MODEL?.trim() || "BAAI/bge-reranker-v2-m3";
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          source_sentence: query,
          sentences: texts,
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as number[] | { score: number }[];
    if (!Array.isArray(data)) return null;
    return data.map((row, index) => ({
      index,
      score: typeof row === "number" ? row : Number((row as { score: number }).score) || 0,
    }));
  } catch (e) {
    console.warn("[rerank] remote BGE failed:", e);
    return null;
  }
}

/**
 * 對候選片段重排：優先遠端 BGE-Reranker，失敗則本地 BGE 風格。
 */
export async function rerankCandidates(
  query: string,
  candidates: RerankCandidate[],
  topN = candidates.length,
): Promise<{ results: RerankResult[]; mode: "bge-remote" | "bge-local" }> {
  if (candidates.length <= 1) {
    return {
      results: candidates.map((c) => ({ id: c.id, score: c.semantic ?? 0 })),
      mode: "bge-local",
    };
  }

  const remote = await remoteBgeRerank(
    query,
    candidates.map((c) => c.text.slice(0, 1800)),
  );
  if (remote && remote.length > 0) {
    const byIndex = new Map(remote.map((r) => [r.index, r.score]));
    const results = candidates
      .map((c, i) => ({ id: c.id, score: byIndex.get(i) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
    return { results, mode: "bge-remote" };
  }

  return {
    results: localBgeStyleRerank(query, candidates).slice(0, topN),
    mode: "bge-local",
  };
}

/** 測試／除錯用：純語意餘弦（需已有向量） */
export function cosineRerank(
  queryVec: number[],
  docs: Array<{ id: string; vec: number[] | null }>,
): RerankResult[] {
  return docs
    .map((d) => ({
      id: d.id,
      score: d.vec ? cosineSimilarity(queryVec, d.vec) : 0,
    }))
    .sort((a, b) => b.score - a.score);
}
