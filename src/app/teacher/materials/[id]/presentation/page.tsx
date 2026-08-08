import Link from "next/link";
import { redirect } from "next/navigation";

import { MaterialPresentationEditor } from "@/components/MaterialPresentationEditor";
import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import { contentToSlides } from "@/lib/material-presentation";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TeacherMaterialPresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const { id } = await params;
  const materialId = id?.trim();
  if (!materialId) redirect("/teacher/materials");

  try {
    await ensureTeacherSchema();
  } catch (e) {
    console.error("[teacher/materials/presentation] ensure failed:", e);
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

  const initialSlides = contentToSlides({
    title: material.title,
    category: material.category,
    unitCode: material.unitCode,
    summary: material.summary,
    content: material.content,
  });

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <MaterialPresentationEditor
        materialId={material.id}
        materialTitle={material.title}
        initialSlides={initialSlides}
        listHref="/teacher/materials"
      />
    </section>
  );
}
