import Link from "next/link";

import { isDatabaseReady } from "@/lib/ensure-db";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string; q?: string }>;
}) {
  const ready = await isDatabaseReady();
  const session = await getSession();
  const sp = searchParams ? await searchParams : {};
  const categoryFilter = sp.category?.trim() || "";
  const q = sp.q?.trim() || "";

  if (!ready) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">題庫</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">資料庫尚未就緒，請先完成初始化。</p>
      </section>
    );
  }

  const all = await prisma.questionBankItem.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      question: true,
      category: true,
      keywords: true,
      relatedSlugs: true,
      hintAnswer: true,
    },
  });

  const categories = [...new Set(all.map((i) => i.category))];
  const filtered = all.filter((item) => {
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (!q) return true;
    const hay = `${item.question} ${item.keywords.join(" ")} ${item.key}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const byCategory = new Map<string, typeof filtered>();
  for (const item of filtered) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

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
              共 {all.length} 題
              {filtered.length !== all.length ? `，目前顯示 ${filtered.length} 題` : ""}
              、{categories.length} 個分類
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
              className="mt-1 block rounded-md border border-[var(--border)] bg-white px-3 py-2"
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
          沒有符合條件的題目。
          {all.length === 0 ? " 請由管理者／老師匯入或新增題庫。" : null}
        </div>
      ) : (
        [...byCategory.entries()].map(([category, items]) => (
          <div
            key={category}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
          >
            <h2 className="text-base font-semibold">
              {category}
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">{items.length} 題</span>
            </h2>
            <ul className="mt-4 space-y-4">
              {items.map((item, idx) => (
                <li
                  key={item.id}
                  className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="text-xs text-[var(--muted)]">
                    {idx + 1}. <span className="font-mono">{item.key}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{item.question}</p>
                  {item.keywords.length > 0 ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      關鍵詞：{item.keywords.join("、")}
                    </p>
                  ) : null}
                  {item.hintAnswer ? (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-[var(--accent)]">學習導引</summary>
                      <p className="mt-2 whitespace-pre-wrap text-[var(--muted)]">{item.hintAnswer}</p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
