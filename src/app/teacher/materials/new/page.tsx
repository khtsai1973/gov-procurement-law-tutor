import { redirect } from "next/navigation";

import { UnitMaterialForm } from "@/components/UnitMaterialForm";
import { getSession } from "@/lib/get-session";
import { TOPIC_CATEGORY_OPTIONS } from "@/lib/question-bank-categories";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TeacherMaterialNewPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const sp = searchParams ? await searchParams : {};
  const category = sp.category?.trim() || "";
  const defaultCategory =
    category &&
    TOPIC_CATEGORY_OPTIONS.includes(category as (typeof TOPIC_CATEGORY_OPTIONS)[number])
      ? category
      : undefined;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">單元教材</p>
            <h1 className="mt-1 text-xl font-semibold">新增教材</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              儲存成功後會自動返回「單元教材首頁」列表。
            </p>
          </div>
          <a href="/teacher/materials" className="text-sm font-medium no-underline hover:underline">
            ← 返回單元教材首頁
          </a>
        </div>
        <div className="mt-6">
          <UnitMaterialForm defaultCategory={defaultCategory} />
        </div>
      </div>
    </section>
  );
}
