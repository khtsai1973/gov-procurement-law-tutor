"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { generateUnitMaterialDraft } from "@/lib/generate-unit-material";
import { getSession } from "@/lib/get-session";
import {
  canPublishMaterial,
  materialPublishBlockReason,
} from "@/lib/material-review";
import prisma from "@/lib/prisma";
import {
  OFFICIAL_QUESTION_BANK_CATEGORIES,
  isOfficialQuestionBankCategory,
} from "@/lib/question-bank-categories";
import { canAccessTeacher } from "@/lib/roles";

const materialSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "請填寫標題").max(200),
  category: z
    .string()
    .trim()
    .min(1, "請選擇主題分類")
    .refine(isOfficialQuestionBankCategory, {
      message: `主題分類須為正式 ${OFFICIAL_QUESTION_BANK_CATEGORIES.length} 類之一`,
    }),
  unitCode: z.string().trim().max(40).optional().nullable(),
  summary: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(1, "請填寫教材內容").max(50000),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.boolean().default(false),
});

const generateSchema = z.object({
  title: z.string().trim().min(1, "請填寫標題").max(200),
  category: z
    .string()
    .trim()
    .min(1, "請選擇主題分類")
    .refine(isOfficialQuestionBankCategory, {
      message: `主題分類須為正式 ${OFFICIAL_QUESTION_BANK_CATEGORIES.length} 類之一`,
    }),
  unitCode: z.string().trim().max(40).optional().nullable(),
  focus: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

async function requireTeacher() {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    return null;
  }
  return session;
}

/** 單元教材首頁（列表） */
function materialsHomeUrl(highlightId?: string) {
  const params = new URLSearchParams({ saved: "1" });
  if (highlightId) params.set("highlight", highlightId);
  return `/teacher/materials?${params.toString()}`;
}

function asReviewFields(row: {
  source?: string | null;
  reviewStatus?: string | null;
  published?: boolean | null;
}) {
  return {
    source: row.source ?? "MANUAL",
    reviewStatus: row.reviewStatus ?? "NONE",
    published: row.published ?? false,
  };
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

  let savedId = "";
  try {
    await ensureTeacherSchema();
    const data = parsed.data;

    if (data.id) {
      const existing = await prisma.unitMaterial.findUnique({ where: { id: data.id } });
      if (!existing) return { ok: false as const, error: "找不到教材" };
      if (existing.authorId !== session.user.id && session.user.role !== "ADMIN") {
        return { ok: false as const, error: "僅能編輯自己建立的教材" };
      }

      const gate = asReviewFields(existing as { source?: string; reviewStatus?: string });
      if (data.published && !canPublishMaterial(gate)) {
        return {
          ok: false as const,
          error: materialPublishBlockReason(gate) ?? "尚不可發布",
        };
      }

      // 發布後仍允許教師修改內容；AI 教材若已審核完成則維持 APPROVED
      await prisma.unitMaterial.update({
        where: { id: data.id },
        data: {
          title: data.title,
          category: data.category,
          unitCode: data.unitCode || null,
          summary: data.summary || null,
          content: data.content,
          sortOrder: data.sortOrder,
          published: data.published,
        },
      });
      savedId = data.id;
    } else {
      // 手寫新建可直接發布
      const created = await prisma.unitMaterial.create({
        data: {
          title: data.title,
          category: data.category,
          unitCode: data.unitCode || null,
          summary: data.summary || null,
          content: data.content,
          sortOrder: data.sortOrder,
          published: data.published,
          source: "MANUAL",
          reviewStatus: "NONE",
          authorId: session.user.id,
        },
      });
      savedId = created.id;
    }

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");
    revalidatePath(`/teacher/materials/${savedId}/edit`);
    revalidatePath("/materials");
  } catch (e) {
    const message = e instanceof Error ? e.message : "儲存失敗";
    return { ok: false as const, error: message };
  }

  // 成功後由伺服器強制導向列表首頁（避免 client transition 卡在編輯頁）
  redirect(materialsHomeUrl(savedId));
}

/** AI 產生教材草稿：一律待審核、未發布 */
export async function generateUnitMaterial(raw: unknown) {
  const session = await requireTeacher();
  if (!session?.user?.id) {
    return { ok: false as const, error: "需要老師或管理者權限" };
  }

  const parsed = generateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "資料格式不正確" };
  }

  try {
    await ensureTeacherSchema();
    const draft = await generateUnitMaterialDraft({
      title: parsed.data.title,
      category: parsed.data.category,
      unitCode: parsed.data.unitCode,
      focus: parsed.data.focus,
    });

    const created = await prisma.unitMaterial.create({
      data: {
        title: draft.title,
        category: parsed.data.category,
        unitCode: parsed.data.unitCode || null,
        summary: draft.summary,
        content: draft.content,
        sortOrder: parsed.data.sortOrder,
        published: false,
        source: "AI",
        reviewStatus: "PENDING_REVIEW",
        authorId: session.user.id,
      },
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");
    revalidatePath("/materials");
    redirect(`/teacher/materials/${created.id}/edit?generated=1`);
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    const message = e instanceof Error ? e.message : "AI 產生失敗";
    return { ok: false as const, error: message };
  }
}

/** 教師標記審核完成（AI 教材發布前提） */
export async function markUnitMaterialReviewed(id: string) {
  const session = await requireTeacher();
  if (!session?.user?.id) {
    return { ok: false as const, error: "需要老師或管理者權限" };
  }

  const materialId = id?.trim();
  if (!materialId) return { ok: false as const, error: "缺少教材編號" };

  try {
    await ensureTeacherSchema();
    const existing = await prisma.unitMaterial.findUnique({ where: { id: materialId } });
    if (!existing) return { ok: false as const, error: "找不到教材" };
    if (existing.authorId !== session.user.id && session.user.role !== "ADMIN") {
      return { ok: false as const, error: "僅能審核自己建立的教材" };
    }

    const source = (existing as { source?: string }).source ?? "MANUAL";
    if (source !== "AI") {
      return { ok: false as const, error: "僅 AI 產生教材需要標記審核完成" };
    }

    await prisma.unitMaterial.update({
      where: { id: materialId },
      data: {
        reviewStatus: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: session.user.id,
      },
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/materials");
    revalidatePath(`/teacher/materials/${materialId}/edit`);
    revalidatePath("/materials");
    return { ok: true as const, message: "已標記審核完成，可發布給學員" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "審核失敗";
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "刪除失敗";
    return { ok: false as const, error: message };
  }

  redirect("/teacher/materials");
}
