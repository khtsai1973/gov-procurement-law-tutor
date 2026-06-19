import { ingestCorpus } from "@/lib/ingest";
import prisma from "@/lib/prisma";

let bootstrapPromise: Promise<void> | null = null;

/** 若已有法規但無任何 chunk，自動從 data/corpus 載入（免按管理者按鈕） */
export async function ensureKnowledgeBase(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const [chunkCount, regulationCount] = await Promise.all([
      prisma.docChunk.count(),
      prisma.regulation.count(),
    ]);

    if (chunkCount > 0 || regulationCount === 0) return;

    console.log("[knowledge] 自動載入知識庫（DocChunk 為空）…");
    const result = await ingestCorpus("auto-bootstrap");
    console.log(
      `[knowledge] 完成 regulations=${result.regulationCount} chunks=${result.chunkTotal}`,
    );
  })().catch((e) => {
    bootstrapPromise = null;
    console.error("[knowledge] 自動載入失敗:", e);
    throw e;
  });

  return bootstrapPromise;
}
