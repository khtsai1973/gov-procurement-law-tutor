import prisma from "@/lib/prisma";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/**
 * 補齊 DocChunk Parent-Child 階層欄位（幂等）。
 * 正式環境若尚未 db:push，首次 ingest／檢索前自動套用。
 */
export async function ensureDocChunkHierarchySchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DocChunk" ADD COLUMN IF NOT EXISTS "chunkRole" TEXT NOT NULL DEFAULT 'CHILD'`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DocChunk" ADD COLUMN IF NOT EXISTS "parentId" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DocChunk" ADD COLUMN IF NOT EXISTS "articleKey" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "DocChunk_chunkRole_idx" ON "DocChunk"("chunkRole")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "DocChunk_parentId_idx" ON "DocChunk"("parentId")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "DocChunk_articleKey_idx" ON "DocChunk"("articleKey")`,
    );

    // FK：parent → self（若不存在才加）
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "DocChunk"
          ADD CONSTRAINT "DocChunk_parentId_fkey"
          FOREIGN KEY ("parentId") REFERENCES "DocChunk"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    ensured = true;
  })().finally(() => {
    if (!ensured) ensurePromise = null;
  });

  return ensurePromise;
}
