"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { clearQuestionBankCache } from "@/lib/question-bank";
import { invalidateQuestionBankPublicCache } from "@/lib/question-bank-public";
import { syncQuestionBankRegulations } from "@/lib/question-bank-corpus";
import { invalidateRegulationsPublicCache } from "@/lib/regulations-public";
import { ensureQuestionBankSchema } from "@/lib/ensure-question-bank-schema";
import { canAccessTeacher } from "@/lib/roles";

const itemSchema = z.object({
  id: z.string().optional(),
  key: z.string().trim().min(1, "請填寫題目鍵值").max(160),
  question: z.string().trim().min(2, "請填寫題目").max(4000),
  category: z.string().trim().min(1, "請填寫分類").max(80),
  keywordsText: z.string().trim().min(1, "請填寫至少一個關鍵詞"),
  relatedSlugsText: z.string().trim().optional().default(""),
  hintAnswer: z.string().trim().max(12000).optional().nullable(),
  importance: z.enum(["high", "normal"]).optional().default("normal"),
});

function splitList(text: string): string[] {
  return text
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function requireTeacher() {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) return null;
  return session;
}

export async function saveQuestionBankItem(raw: unknown) {
  const session = await requireTeacher();
  if (!session) return { ok: false as const, error: "需要老師或管理者權限" };

  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "資料格式不正確" };
  }

  const data = parsed.data;
  const keywords = splitList(data.keywordsText);
  const relatedSlugs = splitList(data.relatedSlugsText ?? "");
  if (keywords.length === 0) {
    return { ok: false as const, error: "請填寫至少一個關鍵詞" };
  }

  try {
    await ensureQuestionBankSchema().catch(() => undefined);
    if (data.id) {
      const existing = await prisma.questionBankItem.findUnique({ where: { id: data.id } });
      if (!existing) return { ok: false as const, error: "找不到題目" };
      const keyTaken = await prisma.questionBankItem.findFirst({
        where: { key: data.key, NOT: { id: data.id } },
      });
      if (keyTaken) return { ok: false as const, error: "題目鍵值已被使用" };

      await prisma.questionBankItem.update({
        where: { id: data.id },
        data: {
          key: data.key,
          question: data.question,
          category: data.category,
          keywords,
          relatedSlugs,
          hintAnswer: data.hintAnswer || null,
          importance: data.importance ?? "normal",
        },
      });
    } else {
      const keyTaken = await prisma.questionBankItem.findUnique({ where: { key: data.key } });
      if (keyTaken) return { ok: false as const, error: "題目鍵值已被使用" };
      await prisma.questionBankItem.create({
        data: {
          key: data.key,
          question: data.question,
          category: data.category,
          keywords,
          relatedSlugs,
          hintAnswer: data.hintAnswer || null,
          importance: data.importance ?? "normal",
        },
      });
    }

    await syncQuestionBankRegulations(prisma);
    clearQuestionBankCache();
    invalidateQuestionBankPublicCache();
    invalidateRegulationsPublicCache();
    revalidatePath("/question-bank");
    revalidatePath("/teacher/question-bank");
    revalidatePath("/regulations");
    revalidatePath("/mock-exam");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "儲存失敗";
    return { ok: false as const, error: message };
  }
}

export async function deleteQuestionBankItem(id: string) {
  const session = await requireTeacher();
  if (!session) return { ok: false as const, error: "需要老師或管理者權限" };

  try {
    await prisma.questionBankItem.delete({ where: { id } });
    await syncQuestionBankRegulations(prisma);
    clearQuestionBankCache();
    invalidateQuestionBankPublicCache();
    invalidateRegulationsPublicCache();
    revalidatePath("/question-bank");
    revalidatePath("/teacher/question-bank");
    revalidatePath("/regulations");
    revalidatePath("/mock-exam");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "刪除失敗";
    return { ok: false as const, error: message };
  }
}
