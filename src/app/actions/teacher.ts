"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { generateUnitMaterialDraft } from "@/lib/generate-unit-material";
import { getSession } from "@/lib/get-session";
import {
  appendRevisionLog,
  canPublishMaterial,
  DEFAULT_REGULATION_VERSION,
  materialPublishBlockReason,
  normalizeReviewStatus,
} from "@/lib/material-review";
import { MATERIALS_CACHE_TAG } from "@/lib/materials-public";
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
  regulationVersion: z.string().trim().max(200).optional().nullable(),
  revisionNote: z.string().trim().max(500).optional().nullable(),
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
  regulationVersion: z.string().trim().max(200).optional().nullable(),
});

async function requireTeacher() {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    return null;
  }
  return session;
}

function materialsHomeUrl(highlightId?: string) {
  const params = new URLSearchParams({ saved: "1" });
  if (highlightId) params.set("highlight", highlightId);
  return `/teacher/materials?${params.toString()}`;
}

function actorName(session: { user?: { name?: string | null; email?: string | null; nickname?: string | null } }) {
  return session.user?.nickname ?? session.user?.name ?? session.user?.email ?? "教師";
}

function revalidateMaterialPaths(id?: string) {
  revalidatePath("/teacher");
  revalidatePath("/teacher/materials");
  revalidatePath("/materials");
  if (id) revalidatePath(`/teacher/materials/${id}/edit`);
  // 公開教材摘要列表快取
  revalidateTag(MATERIALS_CACHE_TAG);
}

type MaterialRow = {
  id: string;
  authorId: string;
  source: string;
  reviewStatus: string;
  published: boolean;
  content: string;
  title: string;
  revisionLog: string | null;
};

async function loadOwnedMaterial(id: string, session: { user: { id: string; role?: string } }) {
  const existing = await prisma.unitMaterial.findUnique({ where: { id } });
  if (!existing) return { error: "找不到教材" as const };
  if (existing.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return { error: "僅能操作自己建立的教材" as const };
  }
  return { existing: existing as MaterialRow & Record<string, unknown> };
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
    const now = new Date();
    const byName = actorName(session);

    if (data.id) {
      const loaded = await loadOwnedMaterial(data.id, session as { user: { id: string; role?: string } });
      if ("error" in loaded) return { ok: false as const, error: loaded.error };
      const existing = loaded.existing;

      const gate = {
        source: existing.source ?? "MANUAL",
        reviewStatus: existing.reviewStatus ?? "DRAFT",
        published: existing.published,
      };
      if (data.published && !canPublishMaterial(gate)) {
        return {
          ok: false as const,
          error: materialPublishBlockReason(gate) ?? "尚不可發布",
        };
      }

      const fromStatus = normalizeReviewStatus(existing.reviewStatus);
      const contentChanged = existing.content !== data.content || existing.title !== data.title;
      const revisionNote =
        data.revisionNote?.trim() ||
        (contentChanged ? "教師修正教材內容" : data.published !== existing.published ? (data.published ? "發布教材" : "取消發布") : "儲存教材");

      const revisionLog = appendRevisionLog(existing.revisionLog, {
        at: now.toISOString(),
        byId: session.user.id,
        byName,
        note: revisionNote,
        fromStatus,
        toStatus: fromStatus,
      });

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
          regulationVersion: data.regulationVersion?.trim() || existing.regulationVersion || DEFAULT_REGULATION_VERSION,
          lastRevisionAt: now,
          lastRevisionById: session.user.id,
          lastRevisionNote: revisionNote,
          revisionLog,
        },
      });
      savedId = data.id;
    } else {
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
          reviewStatus: "DRAFT",
          regulationVersion: data.regulationVersion?.trim() || DEFAULT_REGULATION_VERSION,
          authorId: session.user.id,
          lastRevisionAt: now,
          lastRevisionById: session.user.id,
          lastRevisionNote: "手寫建立教材",
          revisionLog: appendRevisionLog(null, {
            at: now.toISOString(),
            byId: session.user.id,
            byName,
            note: "手寫建立教材",
            fromStatus: "DRAFT",
            toStatus: "DRAFT",
          }),
        },
      });
      savedId = created.id;
    }

    revalidateMaterialPaths(savedId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "儲存失敗";
    return { ok: false as const, error: message };
  }

  redirect(materialsHomeUrl(savedId));
}

/** AI 產生教材：狀態「待審」，不可直接發布 */
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

    const now = new Date();
    const byName = actorName(session);
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
        aiGeneratedAt: now,
        regulationVersion:
          parsed.data.regulationVersion?.trim() || DEFAULT_REGULATION_VERSION,
        authorId: session.user.id,
        lastRevisionAt: now,
        lastRevisionById: session.user.id,
        lastRevisionNote: "AI 產生草稿，進入待審",
        revisionLog: appendRevisionLog(null, {
          at: now.toISOString(),
          byId: session.user.id,
          byName,
          note: "AI 產生草稿，進入待審",
          fromStatus: "DRAFT",
          toStatus: "PENDING_REVIEW",
        }),
      },
    });

    revalidateMaterialPaths(created.id);
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

/** 送出待審（草稿／退回修正 → 待審） */
export async function submitUnitMaterialForReview(id: string, note?: string) {
  const session = await requireTeacher();
  if (!session?.user?.id) return { ok: false as const, error: "需要老師或管理者權限" };

  const materialId = id?.trim();
  if (!materialId) return { ok: false as const, error: "缺少教材編號" };

  try {
    await ensureTeacherSchema();
    const loaded = await loadOwnedMaterial(materialId, session as { user: { id: string; role?: string } });
    if ("error" in loaded) return { ok: false as const, error: loaded.error };
    const existing = loaded.existing;
    const fromStatus = normalizeReviewStatus(existing.reviewStatus);
    if (fromStatus !== "DRAFT" && fromStatus !== "RETURNED") {
      return { ok: false as const, error: "僅「草稿」或「退回修正」可送出待審" };
    }
    if (existing.published) {
      return { ok: false as const, error: "已發布教材請先取消發布再送審" };
    }

    const now = new Date();
    const byName = actorName(session);
    const revisionNote = note?.trim() || "送出待審";
    await prisma.unitMaterial.update({
      where: { id: materialId },
      data: {
        reviewStatus: "PENDING_REVIEW",
        published: false,
        lastRevisionAt: now,
        lastRevisionById: session.user.id,
        lastRevisionNote: revisionNote,
        revisionLog: appendRevisionLog(existing.revisionLog, {
          at: now.toISOString(),
          byId: session.user.id,
          byName,
          note: revisionNote,
          fromStatus,
          toStatus: "PENDING_REVIEW",
        }),
      },
    });
    revalidateMaterialPaths(materialId);
    return { ok: true as const, message: "已送出，狀態：待審" };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "送審失敗" };
  }
}

/** 核准（待審 → 已核准） */
export async function approveUnitMaterial(id: string, note?: string) {
  const session = await requireTeacher();
  if (!session?.user?.id) return { ok: false as const, error: "需要老師或管理者權限" };

  const materialId = id?.trim();
  if (!materialId) return { ok: false as const, error: "缺少教材編號" };

  try {
    await ensureTeacherSchema();
    const loaded = await loadOwnedMaterial(materialId, session as { user: { id: string; role?: string } });
    if ("error" in loaded) return { ok: false as const, error: loaded.error };
    const existing = loaded.existing;
    const fromStatus = normalizeReviewStatus(existing.reviewStatus);
    if (fromStatus !== "PENDING_REVIEW" && fromStatus !== "RETURNED" && fromStatus !== "DRAFT") {
      return { ok: false as const, error: "目前狀態無法核准" };
    }

    const now = new Date();
    const byName = actorName(session);
    const revisionNote = note?.trim() || "教師核准";
    await prisma.unitMaterial.update({
      where: { id: materialId },
      data: {
        reviewStatus: "APPROVED",
        reviewedAt: now,
        reviewedById: session.user.id,
        reviewNote: revisionNote,
        lastRevisionAt: now,
        lastRevisionById: session.user.id,
        lastRevisionNote: revisionNote,
        revisionLog: appendRevisionLog(existing.revisionLog, {
          at: now.toISOString(),
          byId: session.user.id,
          byName,
          note: revisionNote,
          fromStatus,
          toStatus: "APPROVED",
        }),
      },
    });
    revalidateMaterialPaths(materialId);
    return { ok: true as const, message: "已核准，可發布給學員" };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "核准失敗" };
  }
}

/** 退回修正（待審／已核准 → 退回修正，並取消發布） */
export async function returnUnitMaterial(id: string, note: string) {
  const session = await requireTeacher();
  if (!session?.user?.id) return { ok: false as const, error: "需要老師或管理者權限" };

  const materialId = id?.trim();
  const reason = note?.trim();
  if (!materialId) return { ok: false as const, error: "缺少教材編號" };
  if (!reason) return { ok: false as const, error: "請填寫退回修正原因" };

  try {
    await ensureTeacherSchema();
    const loaded = await loadOwnedMaterial(materialId, session as { user: { id: string; role?: string } });
    if ("error" in loaded) return { ok: false as const, error: loaded.error };
    const existing = loaded.existing;
    const fromStatus = normalizeReviewStatus(existing.reviewStatus);
    if (fromStatus !== "PENDING_REVIEW" && fromStatus !== "APPROVED") {
      return { ok: false as const, error: "僅「待審」或「已核准」可退回修正" };
    }

    const now = new Date();
    const byName = actorName(session);
    await prisma.unitMaterial.update({
      where: { id: materialId },
      data: {
        reviewStatus: "RETURNED",
        published: false,
        reviewedAt: now,
        reviewedById: session.user.id,
        reviewNote: reason,
        lastRevisionAt: now,
        lastRevisionById: session.user.id,
        lastRevisionNote: `退回修正：${reason}`,
        revisionLog: appendRevisionLog(existing.revisionLog, {
          at: now.toISOString(),
          byId: session.user.id,
          byName,
          note: `退回修正：${reason}`,
          fromStatus,
          toStatus: "RETURNED",
        }),
      },
    });
    revalidateMaterialPaths(materialId);
    return { ok: true as const, message: "已退回修正" };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "退回失敗" };
  }
}

/** @deprecated 使用 approveUnitMaterial */
export async function markUnitMaterialReviewed(id: string) {
  return approveUnitMaterial(id, "教師核准");
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
    revalidateMaterialPaths();
  } catch (e) {
    const message = e instanceof Error ? e.message : "刪除失敗";
    return { ok: false as const, error: message };
  }

  redirect("/teacher/materials");
}
