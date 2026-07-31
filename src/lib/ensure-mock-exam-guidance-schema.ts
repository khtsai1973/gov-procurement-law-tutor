import prisma from "@/lib/prisma";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/** 補齊 MockExamSupplement 老師指導相關欄位（幂等） */
export async function ensureMockExamGuidanceSchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "MockExamSupplement"
        ADD COLUMN IF NOT EXISTS "guidanceAskNote" TEXT,
        ADD COLUMN IF NOT EXISTS "guidanceRequestedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "teacherGuidance" TEXT,
        ADD COLUMN IF NOT EXISTS "guidanceRepliedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "guidanceByUserId" TEXT
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "MockExamSupplement_guidanceRequestedAt_idx" ON "MockExamSupplement"("guidanceRequestedAt")`,
    );
    ensured = true;
  })().finally(() => {
    if (!ensured) ensurePromise = null;
  });

  return ensurePromise;
}
