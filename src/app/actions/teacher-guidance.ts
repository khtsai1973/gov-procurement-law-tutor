"use server";

import { revalidatePath } from "next/cache";

import { ensureMockExamGuidanceSchema } from "@/lib/ensure-mock-exam-guidance-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export async function replyTeacherGuidance(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    return { ok: false as const, error: "需要老師權限" };
  }

  await ensureMockExamGuidanceSchema();

  const id = String(formData.get("id") ?? "").trim();
  const guidance = String(formData.get("teacherGuidance") ?? "").trim();
  if (!id) return { ok: false as const, error: "缺少紀錄 id" };
  if (!guidance) return { ok: false as const, error: "請填寫老師指導內容" };
  if (guidance.length > 4000) return { ok: false as const, error: "內容過長" };

  const row = await prisma.mockExamSupplement.findUnique({ where: { id } });
  if (!row || !row.guidanceRequestedAt) {
    return { ok: false as const, error: "找不到學員提問" };
  }

  await prisma.mockExamSupplement.update({
    where: { id },
    data: {
      teacherGuidance: guidance,
      guidanceRepliedAt: new Date(),
      guidanceByUserId: session.user.id,
    },
  });

  revalidatePath("/teacher/guidance");
  revalidatePath("/teacher");
  revalidatePath("/mock-exam");
  return { ok: true as const };
}
