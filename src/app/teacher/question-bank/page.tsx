import Link from "next/link";
import { redirect } from "next/navigation";

import { QuestionBankItemForm } from "@/components/QuestionBankItemForm";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function TeacherQuestionBankPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string; category?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const sp = searchParams ? await searchParams : {};
  const editId = typeof sp.edit === "string" ? sp.edit.trim() : "";
  const categoryFilter = typeof sp.category === "string" ? sp.category.trim() : "";
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  try {
    const grouped = await prisma.questionBankItem.groupBy({
      by: ["category"],
      _count: { _all: true },
      orderBy: { category: "asc" },
    });
    const categories = grouped.map((g) => g.category);
    const totalCount = grouped.reduce((sum, g) => sum + g._count._all, 0);

    const where = categoryFilter ? { category: categoryFilter } : {};
    const filteredCount = await prisma.questionBankItem.count({ where });
    const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);

    const [editing, list] = await Promise.all([
      editId
        ? prisma.questionBankItem.findUnique({ where: { id: editId } })
        : Promise.resolve(null),
      prisma.questionBankItem.findMany({
        where,
        orderBy: [{ category: "asc" }, { key: "asc" }],
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          key: true,
          question: true,
          category: true,
        },
      }),
    ]);

    const listQs = new URLSearchParams();
    if (categoryFilter) listQs.set("category", categoryFilter);
    const listBase = listQs.toString();
    const pageHref = (p: number) => {
      const next = new URLSearchParams(listBase);
      if (p > 1) next.set("page", String(p));
      const s = next.toString();
      return s ? `/teacher/question-bank?${s}` : "/teacher/question-bank";
    };
    const editHref = (id: string) => {
      const next = new URLSearchParams(listBase);
      if (safePage > 1) next.set("page", String(safePage));
      next.set("edit", id);
      return `/teacher/question-bank?${next.toString()}`;
    };

    return (
      <section className="space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">管理題庫</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                新增或編輯題庫題目；儲存後會同步至法規清單中的題庫分類，並供模擬考試／問答檢索使用。
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">目前共 {totalCount} 題</p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/teacher" className="no-underline hover:underline">
                ← 老師工作台
              </Link>
              <Link href="/question-bank" className="no-underline hover:underline">
                學員題庫頁
              </Link>
              {editId ? (
                <Link href={pageHref(safePage)} className="no-underline hover:underline">
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
            <h2 className="text-base font-semibold">
              題目列表
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                {filteredCount !== totalCount ? `符合 ${filteredCount} 題` : `${filteredCount} 題`}
              </span>
            </h2>
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
            <>
              <ul className="mt-4 divide-y divide-[var(--border)]">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--muted)]">
                        {item.category}｜<span className="font-mono">{item.key}</span>
                      </div>
                      <p className="mt-1 text-sm line-clamp-2">{item.question}</p>
                    </div>
                    <Link
                      href={editHref(item.id)}
                      className="shrink-0 text-sm no-underline hover:underline"
                    >
                      編輯
                    </Link>
                  </li>
                ))}
              </ul>
              {totalPages > 1 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-sm">
                  <span className="text-[var(--muted)]">
                    第 {safePage} / {totalPages} 頁
                  </span>
                  <div className="flex gap-3">
                    {safePage > 1 ? (
                      <Link href={pageHref(safePage - 1)} className="no-underline hover:underline">
                        上一頁
                      </Link>
                    ) : null}
                    {safePage < totalPages ? (
                      <Link href={pageHref(safePage + 1)} className="no-underline hover:underline">
                        下一頁
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    );
  } catch (e) {
    console.error("[teacher/question-bank] load failed:", e);
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-amber-950">管理題庫</h1>
        <p className="mt-3 text-sm text-amber-900">題庫資料讀取失敗，請稍後再試或確認資料庫已初始化。</p>
        <Link href="/teacher" className="mt-4 inline-block text-sm underline">
          返回老師工作台
        </Link>
      </section>
    );
  }
}
