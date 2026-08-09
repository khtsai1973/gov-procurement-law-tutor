import Link from "next/link";
import { redirect } from "next/navigation";

import { AiMaterialGenerateForm } from "@/components/AiMaterialGenerateForm";
import { getSession } from "@/lib/get-session";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TeacherMaterialGeneratePage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const sp = searchParams ? await searchParams : {};
  const defaultCategory = sp.category?.trim() || undefined;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">單元教材</p>
            <h1 className="mt-1 text-xl font-semibold">AI 產生教材草稿</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              依知識庫產生草稿後，請於編輯頁審核內容，標記「審核完成」後才可發布；發布後仍可編輯。
            </p>
          </div>
          <Link href="/teacher/materials" className="text-sm font-medium no-underline hover:underline">
            ← 返回單元教材首頁
          </Link>
        </div>
        <div className="mt-6">
          <AiMaterialGenerateForm defaultCategory={defaultCategory} />
        </div>
      </div>
    </section>
  );
}
