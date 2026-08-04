import { ingestCorpus } from "@/lib/ingest";
import { ensureDocChunkHierarchySchema } from "@/lib/ensure-doc-chunk-hierarchy-schema";
import prisma from "@/lib/prisma";

let bootstrapPromise: Promise<void> | null = null;

/**
 * 若已有法規但無任何 chunk，自動從 data/corpus 載入。
 * 若已有扁平切片但尚無 PARENT，則升級為 Parent-Child 架構（重跑 ingest）。
 */
export async function ensureKnowledgeBase(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    await ensureDocChunkHierarchySchema().catch((e) => {
      console.warn("[knowledge] ensureDocChunkHierarchySchema:", e);
    });

    const [chunkCount, regulationCount, parentCount] = await Promise.all([
      prisma.docChunk.count(),
      prisma.regulation.count(),
      prisma.docChunk.count({ where: { chunkRole: "PARENT" } }).catch(() => 0),
    ]);

    if (regulationCount === 0) return;

    if (chunkCount === 0) {
      console.log("[knowledge] 自動載入知識庫（DocChunk 為空）…");
      const result = await ingestCorpus("auto-bootstrap");
      console.log(
        `[knowledge] 完成 regulations=${result.regulationCount} parents=${result.parentTotal} children=${result.childTotal}`,
      );
      return;
    }

    if (parentCount === 0) {
      console.log("[knowledge] 升級知識庫為 Parent-Child Chunking…");
      const result = await ingestCorpus("auto-parent-child-upgrade");
      console.log(
        `[knowledge] 升級完成 parents=${result.parentTotal} children=${result.childTotal}`,
      );
    }
  })().catch((e) => {
    bootstrapPromise = null;
    console.error("[knowledge] 自動載入失敗:", e);
    throw e;
  });

  return bootstrapPromise;
}
