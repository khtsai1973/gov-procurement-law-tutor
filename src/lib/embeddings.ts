import OpenAI from "openai";

export function canUseEmbeddings(): boolean {
  const key = process.env.OPENAI_API_KEY?.trim();
  const off = process.env.OPENAI_DISABLED === "true" || process.env.OPENAI_DISABLED === "1";
  return Boolean(key && !off);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || texts.length === 0) return [];

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

  const input = texts.map((t) => t.slice(0, 8000));
  const res = await client.embeddings.create({ model, input });

  return res.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
}

export function parseEmbedding(stored: string | null | undefined): number[] | null {
  if (!stored) return null;
  try {
    const arr = JSON.parse(stored) as number[];
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch {
    return null;
  }
}
