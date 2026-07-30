import Link from "next/link";

import { isDatabaseReady } from "@/lib/ensure-db";
import { ensureOfficialQuestionBankCategories } from "@/lib/ensure-question-bank-categories";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string; q?: string; page?: string }>;
}) {
  const ready = await isDatabaseReady();
  const session = await getSession();
  const sp = (searchParams ? await searchParams : {}) ?? {};
  const categoryFilter = typeof sp.category === "string" ? sp.category.trim() : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  if (!ready) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">題庫</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">資料庫尚未就緒，請先完成初始化。</p>
      </section>
    );
  }

  try {
    await ensureOfficialQuestionBankCategories();

    const grouped = await prisma.questionBankItem.groupBy({
      by: ["category"],
      _count: { _all: true },
      orderBy: { category: "asc" },
    });
    const categories = grouped.map((g) => g.category);
    const totalCount = grouped.reduce((sum, g) => sum + g._count._all, 0);

    const where = {
      ...(categoryFilter ? { category: categoryFilter } : {}),
      ...(q
        ? {
            OR: [
              { question: { contains: q, mode: "insensitive" as const } },
              { key: { contains: q, mode: "insensitive" as const } },
              { keywords: { has: q } },
            ],
          }
        : {}),
    };

    const filteredCount = await prisma.questionBankItem.count({ where });
    const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);

    const pageItems = await prisma.questionBankItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { key: "asc" }],
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        key: true,
        question: true,
        category: true,
        keywords: true,
        hintAnswer: true,
      },
    });

    const byCategory = new Map<string, typeof pageItems>();
    for (const item of pageItems) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const qs = new URLSearchParams();
    if (categoryFilter) qs.set("category", categoryFilter);
    if (q) qs.set("q", q);
    const baseQs = qs.toString();
    const pageHref = (p: number) => {
      const next = new URLSearchParams(baseQs);
      if (p > 1) next.set("page", String(p));
      const s = next.toString();
      return s ? `/question-bank?${s}` : "/question-bank";
    };

    const indexById = new Map(
      pageItems.map((item, i) => [item.id, (safePage - 1) * PAGE_SIZE + i + 1]),
    );

    return (
      <section className="space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">題庫</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                政府採購法規常見試題與關鍵詞整理，供學習、模擬考試與問答檢索參考。導引文字非法條原文。
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                共 {totalCount} 題、{categories.length} 個分類
                {filteredCount !== totalCount ? `；目前符合 ${filteredCount} 題` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/mock-exam" className="no-underline hover:underline">
                模擬考試
              </Link>
              {canAccessTeacher(session?.user?.role) ? (
                <Link href="/teacher/question-bank" className="no-underline hover:underline">
                  管理題庫
                </Link>
              ) : null}
              <Link href="/" className="no-underline hover:underline">
                ← 回到問答
              </Link>
            </div>
          </div>

          <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">分類</span>
              <select
                name="category"
                defaultValue={categoryFilter}
                className="mt-1 block max-w-xs rounded-md border border-[var(--border)] bg-white px-3 py-2"
              >
                <option value="">全部</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[12rem] flex-1 text-sm">
              <span className="text-[var(--muted)]">搜尋</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="關鍵詞或題目文字"
                className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              篩選
            </button>
          </form>
        </div>

        {pageItems.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
            沒有符合條件的題目。
            {totalCount === 0 ? " 請由管理者／老師匯入或新增題庫。" : null}
          </div>
        ) : (
          <>
            {[...byCategory.entries()].map(([category, items]) => (
              <div
                key={category}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
              >
                <h2 className="text-base font-semibold">
                  {category}
                  <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                    本頁 {items.length} 題
                  </span>
                </h2>
                <ul className="mt-4 space-y-4">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="text-xs text-[var(--muted)]">
                        {indexById.get(item.id)}.{" "}
                        <span className="font-mono">{item.key}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                        {item.question}
                      </p>
                      {(item.keywords ?? []).length > 0 ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          關鍵詞：{(item.keywords ?? []).slice(0, 12).join("、")}
                          {(item.keywords ?? []).length > 12 ? "…" : ""}
                        </p>
                      ) : null}
                      {item.hintAnswer ? (
                        <details className="mt-2 text-sm">
                          <summary className="cursor-pointer text-[var(--accent)]">學習導引</summary>
                          <p className="mt-2 whitespace-pre-wrap text-[var(--muted)]">
                            {item.hintAnswer}
                          </p>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
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
      </section>
    );
  } catch (e) {
    const loadError = e instanceof Error ? e.message : "題庫讀取失敗";
    console.error("[question-bank] load failed:", e);
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-amber-950">題庫</h1>
        <p className="mt-3 text-sm text-amber-900">
          題庫資料讀取失敗。請確認已執行{" "}
          <code className="rounded bg-white/80 px-1">npm run db:push</code> 與{" "}
          <code className="rounded bg-white/80 px-1">npm run corpus:import-question-bank</code>。
        </p>
        <p className="mt-2 text-xs text-amber-800/80 break-all">{loadError}</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          返回首頁
        </Link>
      </section>
    );
  }
}
