"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

const materialSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "請填寫標題").max(200),
  unitCode: z.string().trim().max(40).optional().nullable(),
  summary: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(1, "請填寫教材內容").max(50000),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.boolean().default(false),
});

async function requireTeacher() {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    return null;
  }
  return session;
}

export async function saveUnitMaterial(raw: unknown) {
  const session = await requireTeacher();
  if (!session?.user?.id) {
    return { ok: false as const, error: "需要老師或管理者權限" };
  }

  const parsed = materialSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "資料格式不正確" };
  }

  try {
    await ensureTeacherSchema();
    const data = parsed.data;
    const payload = {
      title: data.title,
      unitCode: data.unitCode || null,
      summary: data.summary || null,
      content: data.content,
      sortOrder: data.sortOrder,
      published: data.published,
    };

    if (data.id) {
      const existing = await prisma.unitMaterial.findUnique({ where: { id: data.id } });
      if (!existing) return { ok: false as const, error: "找不到教材" };
      if (existing.authorId !== session.user.id && session.user.role !== "ADMIN") {
        return { ok: false as const, error: "僅能編輯自己建立的教材" };
      }
      await prisma.unitMaterial.update({
        where: { id: data.id },
        data: payload,
      });
    } else {
      await prisma.unitMaterial.create({
        data: {
          ...payload,
          authorId: session.user.id,
        },
      });
    }

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");
    revalidatePath("/materials");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "儲存失敗";
    return { ok: false as const, error: message };
  }
}

export async function deleteUnitMaterial(id: string) {
  const session = await requireTeacher();
  if (!session?.user?.id) {
    return { ok: false as const, error: "需要老師或管理者權限" };
  }

  try {
    await ensureTeacherSchema();
    const existing = await prisma.unitMaterial.findUnique({ where: { id } });
    if (!existing) return { ok: false as const, error: "找不到教材" };
    if (existing.authorId !== session.user.id && session.user.role !== "ADMIN") {
      return { ok: false as const, error: "僅能刪除自己建立的教材" };
    }
    await prisma.unitMaterial.delete({ where: { id } });
    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");
    revalidatePath("/materials");
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "刪除失敗";
    return { ok: false as const, error: message };
  }
}
