"use server";

import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { ingestCorpus } from "@/lib/ingest";
import { replaceQuestionBankFromDisk } from "@/lib/import-question-bank";
import { clearQuestionBankCache } from "@/lib/question-bank";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import {
  isAdminRole,
  isAssignableRole,
  roleLabel,
  validateUserRoleChange,
} from "@/lib/roles";

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

/** 管理者：調整其他使用者的角色群組（學員／老師／管理者） */
export async function updateUserRole(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return { ok: false as const, error: "需要管理者權限" };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim();

  if (!userId) return { ok: false as const, error: "缺少使用者編號" };
  if (!isAssignableRole(roleRaw)) {
    return { ok: false as const, error: "無效的角色" };
  }
  const nextRole: Role = roleRaw;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!target) return { ok: false as const, error: "找不到使用者" };

  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  const check = validateUserRoleChange({
    actorUserId: session.user.id,
    targetUserId: target.id,
    currentRole: target.role,
    nextRole,
    adminCount,
  });
  if (!check.ok) return { ok: false as const, error: check.error };

  await prisma.user.update({
    where: { id: target.id },
    data: { role: nextRole },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return {
    ok: true as const,
    message: `已將 ${target.email ?? "使用者"} 調整為「${roleLabel(nextRole)}」`,
  };
}
