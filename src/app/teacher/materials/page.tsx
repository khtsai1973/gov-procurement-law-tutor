import Link from "next/link";
import { redirect } from "next/navigation";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { TOPIC_CATEGORY_OPTIONS } from "@/lib/question-bank-categories";
import { canAccessTeacher } from "@/lib/roles";
import { groupMaterialsByCategory } from "@/lib/unit-materials";
import {
  formatMaterialDate,
  materialStatusLabel,
  materialStatusTone,
} from "@/lib/material-review";

export const dynamic = "force-dynamic";

/** 單元教材首頁：僅列表（新增／編輯在獨立路徑） */
export default async function TeacherMaterialsHomePage({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string;
    saved?: string;
    highlight?: string;
    /** 舊連結相容：導向獨立編輯／新增頁 */
    edit?: string;
    new?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const sp = searchParams ? await searchParams : {};

  // 相容舊 URL：?edit= / ?new=1 → 獨立頁
  if (sp.edit?.trim()) {
    const q = sp.category?.trim()
      ? `?category=${encodeURIComponent(sp.category.trim())}`
      : "";
    redirect(`/teacher/materials/${sp.edit.trim()}/edit${q}`);
  }
  if (sp.new === "1" || sp.new === "true") {
    const q = sp.category?.trim()
      ? `?category=${encodeURIComponent(sp.category.trim())}`
      : "";
    redirect(`/teacher/materials/new${q}`);
  }

  try {
    await ensureTeacherSchema();
  } catch (e) {
    console.error("[teacher/materials] ensureTeacherSchema failed:", e);
  }

  const filterCategory = sp.category?.trim() || null;
  const justSaved = sp.saved === "1";
  const highlightId = sp.highlight?.trim() || null;

  let materials: Array<{
    id: string;
    title: string;
    category: string;
    unitCode: string | null;
    summary: string | null;
    sortOrder: number;
    published: boolean;
    source?: string;
    reviewStatus?: string;
    aiGeneratedAt?: Date | null;
    reviewedAt?: Date | null;
    reviewedById?: string | null;
    regulationVersion?: string | null;
    lastRevisionAt?: Date | null;
    lastRevisionNote?: string | null;
    lastRevisionById?: string | null;
    author: { email: string | null; name: string | null };
  }> = [];

  try {
    materials = await prisma.unitMaterial.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      include: { author: { select: { email: true, name: true } } },
    });
  } catch (e) {
    console.error("[teacher/materials] query failed, retry ensure:", e);
    await ensureTeacherSchema();
    materials = await prisma.unitMaterial.findMany({
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      include: { author: { select: { email: true, name: true } } },
    });
  }

  const reviewerIds = [
    ...new Set(
      materials
        .flatMap((m) => [m.reviewedById, m.lastRevisionById])
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const reviewerUsers =
    reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const reviewerNameById = new Map(
    reviewerUsers.map(
      (u) => [u.id, u.name?.trim() || u.email || u.id] as const,
    ),
  );

  const filtered = filterCategory
    ? materials.filter((m) => m.category === filterCategory)
    : materials;
  const groups = groupMaterialsByCategory(filtered);
  const newHref = filterCategory
    ? `/teacher/materials/new?category=${encodeURIComponent(filterCategory)}`
    : "/teacher/materials/new";

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--muted)]">老師功能</p>
            <h1 className="mt-1 text-xl font-semibold">單元教材首頁</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              這是教材列表首頁。狀態：草稿 → 待審 → 已核准 → 已發布（可退回修正）。AI
              產生後不可直接發布，須經教師核准。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/teacher" className="no-underline hover:underline">
              ← 老師工作台
            </Link>
            <Link href="/materials" className="no-underline hover:underline">
              預覽學員教材頁
            </Link>
            <Link
              href={
                filterCategory
                  ? `/teacher/materials/generate?category=${encodeURIComponent(filterCategory)}`
                  : "/teacher/materials/generate"
              }
              className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 font-medium text-sky-900 no-underline hover:bg-sky-100"
            >
              AI 產生草稿
            </Link>
            <Link
              href={newHref}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-medium text-white no-underline hover:bg-blue-800"
            >
              手寫新增
            </Link>
          </div>
        </div>

        {justSaved ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            已儲存並回到單元教材首頁。可在下方列表繼續編輯或進行簡報排版。
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            教材列表（{filtered.length}
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
                          {(() => {
                            const fields = {
                              source: m.source ?? "MANUAL",
                              reviewStatus: m.reviewStatus ?? "DRAFT",
                              published: m.published,
                            };
                            const label = materialStatusLabel(fields);
                            const tone = materialStatusTone(fields);
                            const cls =
                              tone === "emerald"
                                ? "text-emerald-700"
                                : tone === "sky"
                                  ? "text-sky-800"
                                  : tone === "amber"
                                    ? "text-amber-800"
                                    : tone === "rose"
                                      ? "text-rose-700"
                                      : "text-[var(--muted)]";
                            return <span className={`ml-2 text-xs ${cls}`}>{label}</span>;
                          })()}
                        </div>
                        {m.summary ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                            {m.summary}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          作者：{m.author.name ?? m.author.email ?? "—"}｜排序 {m.sortOrder}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          AI 產生：{formatMaterialDate(m.aiGeneratedAt)}｜審核：
                          {formatMaterialDate(m.reviewedAt)}
                          {m.reviewedById
                            ? `（${reviewerNameById.get(m.reviewedById) ?? m.reviewedById}）`
                            : ""}
                          ｜法規版本：{m.regulationVersion?.trim() || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          最後修正：{formatMaterialDate(m.lastRevisionAt)}
                          {m.lastRevisionById
                            ? ` · ${reviewerNameById.get(m.lastRevisionById) ?? m.lastRevisionById}`
                            : ""}
                          {m.lastRevisionNote ? ` · ${m.lastRevisionNote}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                        <Link
                          href={`/teacher/materials/${m.id}/presentation`}
                          className="no-underline hover:underline"
                        >
                          簡報排版
                        </Link>
                        <a
                          href={`/api/teacher/materials/${m.id}/document?format=docx`}
                          className="no-underline hover:underline"
                        >
                          DOCX
                        </a>
                        <a
                          href={`/api/teacher/materials/${m.id}/document?format=pdf`}
                          className="no-underline hover:underline"
                        >
                          PDF
                        </a>
                        <Link
                          href={`/teacher/materials/${m.id}/edit`}
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
