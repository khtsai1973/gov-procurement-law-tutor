import prisma from "@/lib/prisma";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/** 補齊題庫重要度欄位（幂等） */
export async function ensureQuestionBankSchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "QuestionBankItem" ADD COLUMN IF NOT EXISTS "knowledgeTags" TEXT[] DEFAULT ARRAY[]::TEXT[]`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "QuestionBankItem" ADD COLUMN IF NOT EXISTS "importance" TEXT NOT NULL DEFAULT 'normal'`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "QuestionBankItem_importance_idx" ON "QuestionBankItem"("importance")`,
    );
    ensured = true;
  })().finally(() => {
    if (!ensured) ensurePromise = null;
  });

  return ensurePromise;
}
