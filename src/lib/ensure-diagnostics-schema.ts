import prisma from "@/lib/prisma";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/**
 * 補齊模考錯題診斷欄位（幂等；正式環境尚未 db:push 時自動套用）。
 */
export async function ensureDiagnosticsSchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MockExamSession" ADD COLUMN IF NOT EXISTS "diagnosticSummary" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MockExamSession" ADD COLUMN IF NOT EXISTS "diagnosticRecommendations" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MockExamSession" ADD COLUMN IF NOT EXISTS "diagnosticModel" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MockExamSession" ADD COLUMN IF NOT EXISTS "diagnosedAt" TIMESTAMP(3)`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MockExamSessionAnswer" ADD COLUMN IF NOT EXISTS "diagnosticNote" TEXT`,
    );

    ensured = true;
  })().finally(() => {
    if (!ensured) ensurePromise = null;
  });

  return ensurePromise;
}
