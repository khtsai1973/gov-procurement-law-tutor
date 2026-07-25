import Link from "next/link";
import { redirect } from "next/navigation";

import { QuestionBankItemForm } from "@/components/QuestionBankItemForm";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TeacherQuestionBankPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string; category?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const sp = searchParams ? await searchParams : {};
  const editId = sp.edit?.trim() || null;
  const categoryFilter = sp.category?.trim() || "";

  const items = await prisma.questionBankItem.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
  const categories = [...new Set(items.map((i) => i.category))];
  const editing = editId ? items.find((i) => i.id === editId) ?? null : null;
  const list = categoryFilter ? items.filter((i) => i.category === categoryFilter) : items;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">管理題庫</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              新增或編輯題庫題目；儲存後會同步至法規清單中的題庫分類，並供模擬考試／問答檢索使用。
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">目前共 {items.length} 題</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/teacher" className="no-underline hover:underline">
              ← 老師工作台
            </Link>
            <Link href="/question-bank" className="no-underline hover:underline">
              學員題庫頁
            </Link>
            {editId ? (
              <Link href="/teacher/question-bank" className="no-underline hover:underline">
                新增題目
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-base font-semibold">
            {editing ? `編輯：${editing.key}` : "新增題目"}
          </h2>
          <div className="mt-4">
            <QuestionBankItemForm
              key={editing?.id ?? "new"}
              categories={categories}
              initial={
                editing
                  ? {
                      id: editing.id,
                      key: editing.key,
                      question: editing.question,
                      category: editing.category,
                      keywordsText: editing.keywords.join("、"),
                      relatedSlugsText: editing.relatedSlugs.join(","),
                      hintAnswer: editing.hintAnswer ?? "",
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">題目列表</h2>
          <form method="get" className="flex items-center gap-2 text-sm">
            <select
              name="category"
              defaultValue={categoryFilter}
              className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5"
            >
              <option value="">全部分類</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-slate-50"
            >
              篩選
            </button>
          </form>
        </div>

        {list.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">尚無題目。</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {list.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-xs text-[var(--muted)]">
                    {item.category}｜<span className="font-mono">{item.key}</span>
                  </div>
                  <p className="mt-1 text-sm line-clamp-2">{item.question}</p>
                </div>
                <Link
                  href={`/teacher/question-bank?edit=${item.id}`}
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
