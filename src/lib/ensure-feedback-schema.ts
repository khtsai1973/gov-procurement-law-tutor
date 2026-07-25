import prisma from "@/lib/prisma";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/**
 * 補齊 UserQuestion 滿意度／評估欄位（幂等）。
 * 正式環境若尚未手動 db:push，首次請求時自動套用，避免問答／回饋全面失敗。
 */
export async function ensureFeedbackSchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "AnswerFeedback" AS ENUM ('UP', 'DOWN');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserQuestion" ADD COLUMN IF NOT EXISTS "answerModel" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserQuestion" ADD COLUMN IF NOT EXISTS "retrievalMode" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserQuestion" ADD COLUMN IF NOT EXISTS "feedback" "AnswerFeedback"`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserQuestion" ADD COLUMN IF NOT EXISTS "feedbackComment" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UserQuestion" ADD COLUMN IF NOT EXISTS "feedbackAt" TIMESTAMP(3)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UserQuestion_feedback_idx" ON "UserQuestion"("feedback")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UserQuestion_createdAt_idx" ON "UserQuestion"("createdAt")`,
    );

    ensured = true;
  })().finally(() => {
    if (!ensured) ensurePromise = null;
  });

  return ensurePromise;
}
