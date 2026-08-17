/**
 * 公開教材讀取：列表僅摘要；全文另以 API／詳情查詢載入。
 */

import { unstable_cache } from "next/cache";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { buildMaterialInfoFields, type MaterialInfoFields } from "@/lib/material-info";
import prisma from "@/lib/prisma";

export const MATERIALS_CACHE_TAG = "published-materials";
export const MATERIALS_LIST_REVALIDATE_SEC = 60;

export type PublishedMaterialSummary = {
  id: string;
  title: string;
  category: string;
  unitCode: string | null;
  summary: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  source: string | null;
  aiGeneratedAt: string | null;
  reviewedAt: string | null;
  regulationVersion: string | null;
  lastRevisionAt: string | null;
  lastRevisionNote: string | null;
  authorName: string;
};

export type PublishedMaterialDetail = PublishedMaterialSummary & {
  content: string;
  info: MaterialInfoFields;
};

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

const listSelect = {
  id: true,
  title: true,
  category: true,
  unitCode: true,
  summary: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  source: true,
  aiGeneratedAt: true,
  reviewedAt: true,
  regulationVersion: true,
  lastRevisionAt: true,
  lastRevisionNote: true,
  author: { select: { name: true, nickname: true } },
} as const;

async function queryPublishedSummaries(): Promise<PublishedMaterialSummary[]> {
  const rows = await prisma.unitMaterial.findMany({
    where: { published: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    select: listSelect,
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    category: m.category,
    unitCode: m.unitCode,
    summary: m.summary,
    sortOrder: m.sortOrder,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    source: m.source ?? null,
    aiGeneratedAt: toIso(m.aiGeneratedAt),
    reviewedAt: toIso(m.reviewedAt),
    regulationVersion: m.regulationVersion ?? null,
    lastRevisionAt: toIso(m.lastRevisionAt),
    lastRevisionNote: m.lastRevisionNote ?? null,
    authorName: m.author.nickname ?? m.author.name ?? "老師",
  }));
}

/** 已發布教材摘要列表（不含正文；60s 快取） */
export const getPublishedMaterialSummaries = unstable_cache(
  async () => queryPublishedSummaries(),
  ["published-material-summaries-v1"],
  { revalidate: MATERIALS_LIST_REVALIDATE_SEC, tags: [MATERIALS_CACHE_TAG] },
);

/** 列表載入：先查詢；失敗再補 schema 後重試（避免熱路徑每次跑 ensure） */
export async function loadPublishedMaterialSummaries(): Promise<PublishedMaterialSummary[]> {
  try {
    return await getPublishedMaterialSummaries();
  } catch (e) {
    console.error("[materials] summary query failed, ensuring schema:", e);
    try {
      await ensureTeacherSchema();
      // bypass cache after schema repair
      return await queryPublishedSummaries();
    } catch (e2) {
      console.error("[materials] summary fallback failed:", e2);
      return [];
    }
  }
}

async function fetchPublishedMaterialDetail(
  materialId: string,
): Promise<PublishedMaterialDetail | null> {
  const m = await prisma.unitMaterial.findFirst({
    where: { id: materialId, published: true },
    select: {
      ...listSelect,
      content: true,
      reviewedById: true,
      lastRevisionById: true,
    },
  });
  if (!m) return null;

  const nameIds = [m.reviewedById, m.lastRevisionById].filter(
    (x): x is string => Boolean(x),
  );
  const users =
    nameIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: nameIds } },
          select: { id: true, name: true, nickname: true, email: true },
        })
      : [];
  const nameById = new Map(
    users.map((u) => [u.id, u.nickname ?? u.name ?? u.email ?? u.id] as const),
  );

  const summary: PublishedMaterialSummary = {
    id: m.id,
    title: m.title,
    category: m.category,
    unitCode: m.unitCode,
    summary: m.summary,
    sortOrder: m.sortOrder,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    source: m.source ?? null,
    aiGeneratedAt: toIso(m.aiGeneratedAt),
    reviewedAt: toIso(m.reviewedAt),
    regulationVersion: m.regulationVersion ?? null,
    lastRevisionAt: toIso(m.lastRevisionAt),
    lastRevisionNote: m.lastRevisionNote ?? null,
    authorName: m.author.nickname ?? m.author.name ?? "老師",
  };

  return {
    ...summary,
    content: m.content,
    info: buildMaterialInfoFields({
      source: m.source,
      createdAt: m.createdAt,
      aiGeneratedAt: m.aiGeneratedAt,
      reviewedAt: m.reviewedAt,
      regulationVersion: m.regulationVersion,
      lastRevisionAt: m.lastRevisionAt,
      lastRevisionNote: m.lastRevisionNote,
      reviewerName: m.reviewedById
        ? (nameById.get(m.reviewedById) ?? m.reviewedById)
        : null,
      lastRevisionByName: m.lastRevisionById
        ? (nameById.get(m.lastRevisionById) ?? m.lastRevisionById)
        : null,
    }),
  };
}

const getCachedPublishedDetail = unstable_cache(
  async (id: string) => fetchPublishedMaterialDetail(id),
  ["published-material-detail-v1"],
  { revalidate: MATERIALS_LIST_REVALIDATE_SEC, tags: [MATERIALS_CACHE_TAG] },
);

export async function loadPublishedMaterialDetail(
  id: string,
): Promise<PublishedMaterialDetail | null> {
  const materialId = id.trim();
  if (!materialId) return null;

  try {
    return await getCachedPublishedDetail(materialId);
  } catch (e) {
    console.error("[materials] detail query failed, ensuring schema:", e);
    try {
      await ensureTeacherSchema();
      return await fetchPublishedMaterialDetail(materialId);
    } catch (e2) {
      console.error("[materials] detail fallback failed:", e2);
      return null;
    }
  }
}
