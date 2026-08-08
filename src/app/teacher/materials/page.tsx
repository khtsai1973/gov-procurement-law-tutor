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
  searchParams?: Promise<{
    edit?: string;
    new?: string;
    category?: string;
    saved?: string;
    highlight?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  try {
    await ensureTeacherSchema();
  } catch (e) {
    console.error("[teacher/materials] ensureTeacherSchema failed:", e);
  }
  const sp = searchParams ? await searchParams : {};
  const editId = sp.edit?.trim() || null;
  const isNew = sp.new === "1" || sp.new === "true";
  const showForm = Boolean(editId || isNew);
  const filterCategory = sp.category?.trim() || null;
  const justSaved = sp.saved === "1";
  const highlightId = sp.highlight?.trim() || null;

  const homeHref = filterCategory
    ? `/teacher/materials?category=${encodeURIComponent(filterCategory)}`
    : "/teacher/materials";
  const newHref = filterCategory
    ? `/teacher/materials?new=1&category=${encodeURIComponent(filterCategory)}`
    : "/teacher/materials?new=1";

  const authorSelect = { author: { select: { email: true, name: true } } } as const;
  let materials: Array<{
    id: string;
    title: string;
    category: string;
    unitCode: string | null;
    summary: string | null;
    content: string;
    sortOrder: number;
    published: boolean;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    author: { email: string | null; name: string | null };
  }> = [];
  let editing: {
    id: string;
    title: string;
    category: string;
    unitCode: string | null;
    summary: string | null;
    content: string;
    sortOrder: number;
    published: boolean;
  } | null = null;
  try {
    const [list, one] = await Promise.all([
      prisma.unitMaterial.findMany({
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
        include: authorSelect,
      }),
      editId
        ? prisma.unitMaterial.findUnique({ where: { id: editId } })
        : Promise.resolve(null),
    ]);
    materials = list;
    editing = one;
  } catch (e) {
    console.error("[teacher/materials] query failed, retry ensure:", e);
    await ensureTeacherSchema();
    const [list, one] = await Promise.all([
      prisma.unitMaterial.findMany({
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        include: authorSelect,
      }),
      editId
        ? prisma.unitMaterial.findUnique({ where: { id: editId } })
        : Promise.resolve(null),
    ]);
    materials = list;
    editing = one;
  }

  if (editId && !editing) {
    // 編輯目標不存在時回到首頁
    redirect(homeHref);
  }

  const filtered = filterCategory
    ? materials.filter((m) => m.category === filterCategory)
    : materials;
  const groups = groupMaterialsByCategory(filtered);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--muted)]">老師功能</p>
            <h1 className="mt-1 text-xl font-semibold">單元教材首頁</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              依正式 14 類主題管理教材。儲存後會回到本頁列表；簡報請先排版再匯出。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/teacher" className="no-underline hover:underline">
              ← 老師工作台
            </Link>
            <Link href="/materials" className="no-underline hover:underline">
              預覽學員教材頁
            </Link>
            {showForm ? (
              <Link href={homeHref} className="font-medium no-underline hover:underline">
                返回單元教材首頁
              </Link>
            ) : (
              <Link
                href={newHref}
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-white no-underline hover:bg-blue-800"
              >
                新增教材
              </Link>
            )}
          </div>
        </div>

        {justSaved ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            教材已儲存，已回到單元教材首頁。可在下方列表繼續編輯或進行簡報排版。
          </div>
        ) : null}
      </div>

      {showForm ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              {editing ? `編輯：${editing.title}` : "新增單元教材"}
            </h2>
            <Link href={homeHref} className="text-sm no-underline hover:underline">
              ← 返回單元教材首頁
            </Link>
          </div>
          <div className="mt-4">
            <UnitMaterialForm
              key={editing?.id ?? "new"}
              categoryFilter={filterCategory}
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
      ) : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            教材列表（{filtered.length}
            {filterCategory ? `／篩選「${filterCategory}」` : ""}）
          </h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {filterCategory ? (
              <Link href="/teacher/materials" className="no-underline hover:underline">
                清除分類篩選
              </Link>
            ) : null}
            {!showForm ? (
              <Link href={newHref} className="no-underline hover:underline">
                新增教材
              </Link>
            ) : null}
          </div>
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
          <p className="mt-4 text-sm text-[var(--muted)]">
            尚無教材。
            <Link href={newHref} className="ml-2 underline">
              新增第一筆
            </Link>
          </p>
        ) : (
          <div className="mt-5 space-y-6">
            {groups.map((group) => (
              <div key={group.category}>
                <h3 className="text-sm font-semibold text-[var(--fg)]">{group.category}</h3>
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {group.items.map((m) => (
                    <li
                      key={m.id}
                      id={`material-${m.id}`}
                      className={`flex flex-wrap items-start justify-between gap-3 py-3 ${
                        highlightId === m.id ? "rounded-md bg-emerald-50/80 px-2" : ""
                      }`}
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
                      <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                        <Link
                          href={`/teacher/materials/${m.id}/presentation`}
                          className="no-underline hover:underline"
                        >
                          簡報排版
                        </Link>
                        <Link
                          href={`/teacher/materials?edit=${m.id}${
                            filterCategory
                              ? `&category=${encodeURIComponent(filterCategory)}`
                              : ""
                          }`}
                          className="no-underline hover:underline"
                        >
                          編輯
                        </Link>
                      </div>
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
