import Link from "next/link";
import { redirect } from "next/navigation";

import { UnitMaterialForm } from "@/components/UnitMaterialForm";
import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import { buildMaterialInfoFields } from "@/lib/material-info";
import {
  normalizeReviewStatus,
  parseRevisionLog,
} from "@/lib/material-review";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TeacherMaterialEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ generated?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const { id } = await params;
  const materialId = id?.trim();
  if (!materialId) redirect("/teacher/materials");

  const sp = searchParams ? await searchParams : {};
  const justGenerated = sp.generated === "1";

  try {
    await ensureTeacherSchema();
  } catch {
    // ignore; query may still work
  }

  const material = await prisma.unitMaterial.findUnique({ where: { id: materialId } });
  if (!material) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">找不到教材</h1>
        <Link href="/teacher/materials" className="mt-4 inline-block text-sm underline">
          返回單元教材首頁
        </Link>
      </section>
    );
  }

  const source = material.source ?? "MANUAL";
  const reviewStatus = normalizeReviewStatus(material.reviewStatus);
  const revisionLog = parseRevisionLog(material.revisionLog);

  const userIds = [
    material.reviewedById,
    material.lastRevisionById,
    ...revisionLog.map((e) => e.byId),
  ].filter((x): x is string => Boolean(x));

  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...new Set(userIds)] } },
          select: { id: true, name: true, email: true, nickname: true },
        })
      : [];
  const nameById = new Map(
    users.map(
      (u) =>
        [
          u.id,
          u.nickname?.trim() || u.name?.trim() || u.email || u.id,
        ] as const,
    ),
  );

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">單元教材</p>
            <h1 className="mt-1 text-xl font-semibold">編輯：{material.title}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              審核流程：草稿 → 待審 → 已核准 → 已發布；必要時可退回修正。AI
              教材須核准後才能發布。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <a href="/teacher/materials" className="font-medium no-underline hover:underline">
              ← 返回單元教材首頁
            </a>
            <Link
              href={`/teacher/materials/${material.id}/presentation`}
              className="no-underline hover:underline"
            >
              簡報排版
            </Link>
            <a
              href={`/api/teacher/materials/${material.id}/document?format=docx`}
              className="no-underline hover:underline"
            >
              下載 DOCX
            </a>
            <a
              href={`/api/teacher/materials/${material.id}/document?format=pdf`}
              className="no-underline hover:underline"
            >
              下載 PDF
            </a>
          </div>
        </div>
        <div className="mt-6">
          <UnitMaterialForm
            justGenerated={justGenerated}
            initial={{
              id: material.id,
              title: material.title,
              category: material.category,
              unitCode: material.unitCode ?? "",
              summary: material.summary ?? "",
              content: material.content,
              sortOrder: material.sortOrder,
              published: material.published,
              source,
              reviewStatus,
              regulationVersion: material.regulationVersion ?? "",
              reviewNote: material.reviewNote ?? "",
            }}
            meta={{
              info: buildMaterialInfoFields({
                source,
                createdAt: material.createdAt,
                aiGeneratedAt: material.aiGeneratedAt,
                reviewedAt: material.reviewedAt,
                regulationVersion: material.regulationVersion,
                lastRevisionAt: material.lastRevisionAt,
                lastRevisionNote: material.lastRevisionNote,
                reviewerName: material.reviewedById
                  ? (nameById.get(material.reviewedById) ?? material.reviewedById)
                  : null,
                lastRevisionByName: material.lastRevisionById
                  ? (nameById.get(material.lastRevisionById) ??
                    material.lastRevisionById)
                  : null,
              }),
              revisionLog: revisionLog.map((e) => ({
                ...e,
                byName: nameById.get(e.byId) ?? e.byName,
              })),
            }}
          />
        </div>
      </div>
    </section>
  );
}
