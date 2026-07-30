"use server";

import { revalidatePath } from "next/cache";

import { ingestCorpus } from "@/lib/ingest";
import { replaceQuestionBankFromDisk } from "@/lib/import-question-bank";
import { clearQuestionBankCache } from "@/lib/question-bank";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

export async function runKnowledgeIngest() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { ok: false as const, error: "需要管理者權限" };
  }

  try {
    const result = await ingestCorpus(session.user.email ?? session.user.id);
    revalidatePath("/admin");
    return { ok: true as const, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "ingest failed";
    return { ok: false as const, error: message };
  }
}

/** 管理者：清空題庫後自 data/question-bank/*.json 重新匯入 */
export async function runQuestionBankReplace() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { ok: false as const, error: "需要管理者權限" };
  }

  try {
    const before = await prisma.questionBankItem.count();
    const result = await replaceQuestionBankFromDisk(
      prisma,
      session.user.email ?? "admin-replace",
    );
    clearQuestionBankCache();
    revalidatePath("/admin");
    revalidatePath("/question-bank");
    revalidatePath("/mock-exam");
    revalidatePath("/teacher/question-bank");
    revalidatePath("/regulations");
    return {
      ok: true as const,
      before,
      deleted: result.deleted,
      imported: result.imported,
      files: result.files,
      categories: result.synced?.categories ?? null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "question bank replace failed";
    return { ok: false as const, error: message };
  }
}
