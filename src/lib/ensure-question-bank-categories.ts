import prisma from "@/lib/prisma";
import { replaceQuestionBankFromDisk } from "@/lib/import-question-bank";
import { clearQuestionBankCache } from "@/lib/question-bank";

let inFlight: Promise<{ deleted: number; imported: number } | null> | null = null;

/**
 * 若正式庫仍殘留「第 N 條」等舊分類，自動清空並重匯磁碟題庫 JSON。
 * 幂等：已是正式 14 類時不動作。
 */
export async function ensureOfficialQuestionBankCategories(): Promise<{
  deleted: number;
  imported: number;
} | null> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const stale = await prisma.questionBankItem.findFirst({
        where: {
          OR: [
            { category: { startsWith: "第 " } },
            { category: { startsWith: "第" } },
            { category: "未分類章節" },
            { category: "金額門檻" },
            { category: "最有利標" },
            { category: "招標期限" },
            { category: "議價比減" },
            { category: "未達公告金額" },
            { category: "採購人員倫理" },
          ],
        },
        select: { id: true, category: true },
      });
      if (!stale) return null;

      console.warn(
        `[question-bank] stale category detected (${stale.category}); replacing from disk JSON`,
      );
      const result = await replaceQuestionBankFromDisk(prisma, "auto-migrate-14-categories");
      clearQuestionBankCache();
      return { deleted: result.deleted, imported: result.imported };
    } catch (e) {
      console.error("[question-bank] auto-migrate failed:", e);
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
