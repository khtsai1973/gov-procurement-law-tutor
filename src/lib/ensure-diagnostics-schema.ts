import prisma from "@/lib/prisma";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/**
 * 補齊 MockExamSessionAnswer 錯題診斷欄位（幂等）。
 */
export async function ensureDiagnosticsSchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MockExamSessionAnswer" ADD COLUMN IF NOT EXISTS "diagnosticText" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MockExamSessionAnswer" ADD COLUMN IF NOT EXISTS "diagnosticModel" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MockExamSessionAnswer" ADD COLUMN IF NOT EXISTS "diagnosticSources" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "MockExamSessionAnswer" ADD COLUMN IF NOT EXISTS "diagnosedAt" TIMESTAMP(3)`,
    );

    ensured = true;
  })().finally(() => {
    if (!ensured) ensurePromise = null;
  });

  return ensurePromise;
}
