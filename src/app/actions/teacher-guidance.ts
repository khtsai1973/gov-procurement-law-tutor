"use server";

import { revalidatePath } from "next/cache";

import { ensureMockExamGuidanceSchema } from "@/lib/ensure-mock-exam-guidance-schema";
import { getSession } from "@/lib/get-session";
import { sanitizeUserText } from "@/lib/prompt-injection";
import { canAccessTeacher } from "@/lib/roles";
import { withRlsBypass } from "@/lib/with-user-rls";

export async function replyTeacherGuidance(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    return { ok: false as const, error: "需要老師權限" };
  }

  await ensureMockExamGuidanceSchema();

  const id = String(formData.get("id") ?? "").trim();
  const guidance = sanitizeUserText(String(formData.get("teacherGuidance") ?? ""), 4000);
  if (!id) return { ok: false as const, error: "缺少紀錄 id" };
  if (!guidance) return { ok: false as const, error: "請填寫老師指導內容" };

  const updated = await withRlsBypass(async (tx) => {
    const row = await tx.mockExamSupplement.findUnique({ where: { id } });
    if (!row || !row.guidanceRequestedAt) return null;
    return tx.mockExamSupplement.update({
      where: { id },
      data: {
        teacherGuidance: guidance,
        guidanceRepliedAt: new Date(),
        guidanceByUserId: session.user!.id,
      },
    });
  });

  if (!updated) {
    return { ok: false as const, error: "找不到學員提問" };
  }

  revalidatePath("/teacher/guidance");
  revalidatePath("/teacher");
  revalidatePath("/mock-exam");
  return { ok: true as const };
}
