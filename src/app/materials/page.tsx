import Link from "next/link";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }>;
}) {
  await ensureTeacherSchema();
  const session = await getSession();
  const sp = searchParams ? await searchParams : {};
  const focusId = sp.id?.trim() || null;

  const materials = await prisma.unitMaterial.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      unitCode: true,
      summary: true,
      content: true,
      updatedAt: true,
      author: { select: { name: true, nickname: true } },
    },
  });

  const current = focusId ? materials.find((m) => m.id === focusId) : materials[0] ?? null;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">單元教材</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              由老師發布的課程單元。{session?.user ? "" : "登入後可一併使用問答與模擬考試。"}
            </p>
          </div>
          <Link href="/" className="text-sm no-underline hover:underline">
            ← 回到首頁
          </Link>
        </div>

        {materials.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--muted)]">目前尚無已發布的單元教材。</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
            <aside className="space-y-2">
              {materials.map((m) => {
                const active = current?.id === m.id;
                return (
                  <Link
                    key={m.id}
                    href={`/materials?id=${m.id}`}
                    className={`block rounded-md border px-3 py-2 text-sm no-underline ${
                      active
                        ? "border-blue-300 bg-blue-50 text-[var(--fg)]"
                        : "border-[var(--border)] bg-white text-[var(--fg)] hover:bg-slate-50"
                    }`}
                  >
                    {m.unitCode ? (
                      <span className="mr-1 text-xs text-[var(--muted)]">{m.unitCode}</span>
                    ) : null}
                    {m.title}
                  </Link>
                );
              })}
            </aside>

            {current ? (
              <article className="min-w-0">
                <h2 className="text-lg font-semibold">
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
                {current.summary ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">{current.summary}</p>
                ) : null}
                <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed">
                  {current.content}
                </div>
              </article>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
