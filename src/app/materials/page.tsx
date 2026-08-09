import Link from "next/link";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { TOPIC_CATEGORY_OPTIONS } from "@/lib/question-bank-categories";
import { groupMaterialsByCategory } from "@/lib/unit-materials";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; category?: string }>;
}) {
  try {
    await ensureTeacherSchema();
  } catch (e) {
    console.error("[materials] ensureTeacherSchema failed:", e);
  }
  const session = await getSession();
  const sp = searchParams ? await searchParams : {};
  const focusId = sp.id?.trim() || null;
  const filterCategory = sp.category?.trim() || null;

  let materials: {
    id: string;
    title: string;
    category: string;
    unitCode: string | null;
    summary: string | null;
    content: string;
    updatedAt: Date;
    author: { name: string | null; nickname: string | null };
  }[] = [];
  try {
    materials = await prisma.unitMaterial.findMany({
      where: { published: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        category: true,
        unitCode: true,
        summary: true,
        content: true,
        updatedAt: true,
        author: { select: { name: true, nickname: true } },
      },
    });
  } catch (e) {
    console.error("[materials] query with category failed, retrying ensure:", e);
    try {
      await ensureTeacherSchema();
      materials = await prisma.unitMaterial.findMany({
        where: { published: true },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          category: true,
          unitCode: true,
          summary: true,
          content: true,
          updatedAt: true,
          author: { select: { name: true, nickname: true } },
        },
      });
    } catch (e2) {
      console.error("[materials] fallback query failed:", e2);
      materials = [];
    }
  }

  const availableCategories = TOPIC_CATEGORY_OPTIONS.filter((cat) =>
    materials.some((m) => m.category === cat),
  );
  const filtered = filterCategory
    ? materials.filter((m) => m.category === filterCategory)
    : materials;
  const groups = groupMaterialsByCategory(filtered);

  const current = focusId
    ? materials.find((m) => m.id === focusId) ?? null
    : filtered[0] ?? null;

  function hrefFor(opts: { id?: string; category?: string | null }) {
    const params = new URLSearchParams();
    const cat = opts.category === undefined ? filterCategory : opts.category;
    if (cat) params.set("category", cat);
    if (opts.id) params.set("id", opts.id);
    const q = params.toString();
    return q ? `/materials?${q}` : "/materials";
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">單元教材</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              由老師依主題分類發布的課程單元。
              {session?.user ? "" : "登入後可一併使用問答與模擬考試。"}
            </p>
          </div>
          <Link href="/" className="text-sm no-underline hover:underline">
            ← 回到首頁
          </Link>
        </div>

        {materials.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--muted)]">目前尚無已發布的單元教材。</p>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/materials"
                className={`rounded-md border px-2.5 py-1 text-xs no-underline ${
                  !filterCategory
                    ? "border-blue-300 bg-blue-50 text-[var(--fg)]"
                    : "border-[var(--border)] bg-white text-[var(--muted)] hover:bg-slate-50"
                }`}
              >
                全部分類
              </Link>
              {availableCategories.map((cat) => {
                const active = filterCategory === cat;
                return (
                  <Link
                    key={cat}
                    href={hrefFor({ category: cat })}
                    className={`rounded-md border px-2.5 py-1 text-xs no-underline ${
                      active
                        ? "border-blue-300 bg-blue-50 text-[var(--fg)]"
                        : "border-[var(--border)] bg-white text-[var(--muted)] hover:bg-slate-50"
                    }`}
                  >
                    {cat}
                  </Link>
                );
              })}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
              <aside className="space-y-4">
                {groups.map((group) => (
                  <div key={group.category}>
                    <p className="mb-2 text-xs font-semibold text-[var(--muted)]">
                      {group.category}
                    </p>
                    <div className="space-y-2">
                      {group.items.map((m) => {
                        const active = current?.id === m.id;
                        return (
                          <Link
                            key={m.id}
                            href={hrefFor({ id: m.id, category: filterCategory })}
                            className={`block rounded-md border px-3 py-2 text-sm no-underline ${
                              active
                                ? "border-blue-300 bg-blue-50 text-[var(--fg)]"
                                : "border-[var(--border)] bg-white text-[var(--fg)] hover:bg-slate-50"
                            }`}
                          >
                            {m.unitCode ? (
                              <span className="mr-1 text-xs text-[var(--muted)]">
                                {m.unitCode}
                              </span>
                            ) : null}
                            {m.title}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {groups.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">此分類尚無已發布教材。</p>
                ) : null}
              </aside>

              {current ? (
                <article className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-[var(--muted)]">{current.category}</p>
                      <h2 className="mt-1 text-lg font-semibold">
                        {current.unitCode ? `${current.unitCode}｜` : ""}
                        {current.title}
                      </h2>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {current.author.nickname ?? current.author.name ?? "老師"}｜更新於{" "}
                        {new Intl.DateTimeFormat("zh-TW", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(current.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/materials/${current.id}/presentation`}
                        className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-800 no-underline hover:bg-indigo-100"
                      >
                        簡報 PPTX
                      </a>
                      <a
                        href={`/api/materials/${current.id}/document?format=docx`}
                        className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-900 no-underline hover:bg-sky-100"
                      >
                        文件 DOCX
                      </a>
                      <a
                        href={`/api/materials/${current.id}/document?format=pdf`}
                        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-900 no-underline hover:bg-rose-100"
                      >
                        文件 PDF
                      </a>
                    </div>
                  </div>
                  {current.summary ? (
                    <p className="mt-3 text-sm text-[var(--muted)]">{current.summary}</p>
                  ) : null}
                  <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed">
                    {current.content}
                  </div>
                </article>
              ) : (
                <p className="text-sm text-[var(--muted)]">請從左側選擇教材。</p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
