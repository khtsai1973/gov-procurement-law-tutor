import Link from "next/link";
import { redirect } from "next/navigation";

import { UnitMaterialForm } from "@/components/UnitMaterialForm";
import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TeacherMaterialsPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  await ensureTeacherSchema();
  const sp = searchParams ? await searchParams : {};
  const editId = sp.edit?.trim() || null;

  const [materials, editing] = await Promise.all([
    prisma.unitMaterial.findMany({
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      include: { author: { select: { email: true, name: true } } },
    }),
    editId
      ? prisma.unitMaterial.findUnique({ where: { id: editId } })
      : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">製作單元教材</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              建立課程單元內容；勾選「發布」後，學員可於「單元教材」頁閱讀。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/teacher" className="no-underline hover:underline">
              ← 老師工作台
            </Link>
            {editId ? (
              <Link href="/teacher/materials" className="no-underline hover:underline">
                新增教材
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-base font-semibold">
            {editing ? `編輯：${editing.title}` : "新增單元教材"}
          </h2>
          <div className="mt-4">
            <UnitMaterialForm
              key={editing?.id ?? "new"}
              initial={
                editing
                  ? {
                      id: editing.id,
                      title: editing.title,
                      unitCode: editing.unitCode ?? "",
                      summary: editing.summary ?? "",
                      content: editing.content,
                      sortOrder: editing.sortOrder,
                      published: editing.published,
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">已建立教材（{materials.length}）</h2>
        {materials.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">尚無教材，請先新增。</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {materials.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {m.unitCode ? (
                      <span className="mr-2 text-[var(--muted)]">{m.unitCode}</span>
                    ) : null}
                    {m.title}
                    <span
                      className={`ml-2 text-xs ${m.published ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {m.published ? "已發布" : "草稿"}
                    </span>
                  </div>
                  {m.summary ? (
                    <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{m.summary}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    作者：{m.author.name ?? m.author.email ?? "—"}｜排序 {m.sortOrder}
                  </p>
                </div>
                <Link
                  href={`/teacher/materials?edit=${m.id}`}
                  className="shrink-0 text-sm no-underline hover:underline"
                >
                  編輯
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
