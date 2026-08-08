import Link from "next/link";
import { redirect } from "next/navigation";

import { UnitMaterialForm } from "@/components/UnitMaterialForm";
import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { TOPIC_CATEGORY_OPTIONS } from "@/lib/question-bank-categories";
import { canAccessTeacher } from "@/lib/roles";
import { groupMaterialsByCategory } from "@/lib/unit-materials";

export const dynamic = "force-dynamic";

export default async function TeacherMaterialsPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string; category?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  await ensureTeacherSchema();
  const sp = searchParams ? await searchParams : {};
  const editId = sp.edit?.trim() || null;
  const filterCategory = sp.category?.trim() || null;

  const [materials, editing] = await Promise.all([
    prisma.unitMaterial.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      include: { author: { select: { email: true, name: true } } },
    }),
    editId
      ? prisma.unitMaterial.findUnique({ where: { id: editId } })
      : Promise.resolve(null),
  ]);

  const filtered = filterCategory
    ? materials.filter((m) => m.category === filterCategory)
    : materials;
  const groups = groupMaterialsByCategory(filtered);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">依主題分類製作教材</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              選擇正式 14 類主題後撰寫單元內容；勾選「發布」後，學員可於「單元教材」依分類閱讀。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/teacher" className="no-underline hover:underline">
              ← 老師工作台
            </Link>
            <Link href="/materials" className="no-underline hover:underline">
              預覽學員教材頁
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
                      category: editing.category,
                      unitCode: editing.unitCode ?? "",
                      summary: editing.summary ?? "",
                      content: editing.content,
                      sortOrder: editing.sortOrder,
                      published: editing.published,
                    }
                  : filterCategory &&
                      TOPIC_CATEGORY_OPTIONS.includes(
                        filterCategory as (typeof TOPIC_CATEGORY_OPTIONS)[number],
                      )
                    ? {
                        title: "",
                        category: filterCategory,
                        unitCode: "",
                        summary: "",
                        content: "",
                        sortOrder: 0,
                        published: false,
                      }
                    : undefined
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            已建立教材（{filtered.length}
            {filterCategory ? `／篩選「${filterCategory}」` : ""}）
          </h2>
          {filterCategory ? (
            <Link href="/teacher/materials" className="text-sm no-underline hover:underline">
              清除分類篩選
            </Link>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/teacher/materials"
            className={`rounded-md border px-2.5 py-1 text-xs no-underline ${
              !filterCategory
                ? "border-blue-300 bg-blue-50 text-[var(--fg)]"
                : "border-[var(--border)] bg-white text-[var(--muted)] hover:bg-slate-50"
            }`}
          >
            全部
          </Link>
          {TOPIC_CATEGORY_OPTIONS.map((cat) => {
            const count = materials.filter((m) => m.category === cat).length;
            if (count === 0 && filterCategory !== cat) return null;
            const active = filterCategory === cat;
            return (
              <Link
                key={cat}
                href={`/teacher/materials?category=${encodeURIComponent(cat)}`}
                className={`rounded-md border px-2.5 py-1 text-xs no-underline ${
                  active
                    ? "border-blue-300 bg-blue-50 text-[var(--fg)]"
                    : "border-[var(--border)] bg-white text-[var(--muted)] hover:bg-slate-50"
                }`}
              >
                {cat}
                {count > 0 ? `（${count}）` : ""}
              </Link>
            );
          })}
        </div>

        {groups.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">尚無教材，請先新增。</p>
        ) : (
          <div className="mt-5 space-y-6">
            {groups.map((group) => (
              <div key={group.category}>
                <h3 className="text-sm font-semibold text-[var(--fg)]">{group.category}</h3>
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {group.items.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-start justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {m.unitCode ? (
                            <span className="mr-2 text-[var(--muted)]">{m.unitCode}</span>
                          ) : null}
                          {m.title}
                          <span
                            className={`ml-2 text-xs ${
                              m.published ? "text-emerald-700" : "text-amber-700"
                            }`}
                          >
                            {m.published ? "已發布" : "草稿"}
                          </span>
                        </div>
                        {m.summary ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                            {m.summary}
                          </p>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
