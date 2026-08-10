import Link from "next/link";

import { isDatabaseReady } from "@/lib/ensure-db";
import { ensureQuestionBankSchema } from "@/lib/ensure-question-bank-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import {
  explanationDisplayLabel,
  getExplanationOverlayMap,
  resolveQuestionExplanation,
} from "@/lib/question-bank-explanations";
import { extractConceptTags } from "@/lib/concept-tags";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string; q?: string; page?: string; important?: string }>;
}) {
  const ready = await isDatabaseReady();
  const session = await getSession();
  const sp = (searchParams ? await searchParams : {}) ?? {};
  const categoryFilter = typeof sp.category === "string" ? sp.category.trim() : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const importantOnly = sp.important === "1" || sp.important === "true";
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
    await ensureQuestionBankSchema().catch(() => undefined);

    const grouped = await prisma.questionBankItem.groupBy({
      by: ["category"],
      _count: { _all: true },
      orderBy: { category: "asc" },
    });
    const categories = grouped.map((g) => g.category);
    const totalCount = grouped.reduce((sum, g) => sum + g._count._all, 0);

    const overlayKeys = [...getExplanationOverlayMap().keys()];

    const where = {
      ...(categoryFilter ? { category: categoryFilter } : {}),
      ...(importantOnly
        ? {
            OR: [
              { importance: "high" },
              ...(overlayKeys.length ? [{ key: { in: overlayKeys } }] : []),
            ],
          }
        : {}),
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

    let filteredCount = 0;
    let pageItems: {
      id: string;
      key: string;
      question: string;
      category: string;
      keywords: string[];
      hintAnswer: string | null;
      importance?: string | null;
    }[] = [];
    let totalPages = 1;
    let safePage = 1;

    try {
      filteredCount = await prisma.questionBankItem.count({ where });
      totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
      safePage = Math.min(page, totalPages);
      pageItems = await prisma.questionBankItem.findMany({
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
          importance: true,
        },
      });
    } catch {
      const whereFallback = {
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
      filteredCount = await prisma.questionBankItem.count({ where: whereFallback });
      totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
      safePage = Math.min(page, totalPages);
      pageItems = await prisma.questionBankItem.findMany({
        where: whereFallback,
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
    }

    const byCategory = new Map<string, typeof pageItems>();
    for (const item of pageItems) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const qs = new URLSearchParams();
    if (categoryFilter) qs.set("category", categoryFilter);
    if (q) qs.set("q", q);
    if (importantOnly) qs.set("important", "1");
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

    const importantHref = () => {
      const next = new URLSearchParams();
      if (categoryFilter) next.set("category", categoryFilter);
      if (q) next.set("q", q);
      if (!importantOnly) next.set("important", "1");
      const s = next.toString();
      return s ? `/question-bank?${s}` : "/question-bank";
    };

    return (
      <section className="space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">題庫</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                政府採購法規常見試題整理，供學習與模擬考試參考。前台只顯示語意「概念標籤」（如總價結算、廠商資格）；機械切塊關鍵詞僅供後台檢索。高頻／重要題優先提供完整解析。
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

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={importantHref()}
              className={`rounded-md border px-2.5 py-1 text-xs no-underline ${
                importantOnly
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-[var(--border)] bg-white text-[var(--muted)] hover:bg-slate-50"
              }`}
            >
              {importantOnly ? "顯示全部題目" : "只看重要／高頻（含完整解析）"}
            </Link>
          </div>
        </div>

        {pageItems.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">沒有符合的題目。</p>
        ) : (
          <>
            {[...byCategory.entries()].map(([category, items]) => (
              <div
                key={category}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
              >
                <h2 className="text-base font-semibold">{category}</h2>
                <ul className="mt-4 space-y-4">
                  {items.map((item) => {
                    const resolved = resolveQuestionExplanation({
                      key: item.key,
                      hintAnswer: item.hintAnswer,
                      importance: item.importance,
                    });
                    return (
                      <li
                        key={item.id}
                        className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="text-xs text-[var(--muted)]">
                          {indexById.get(item.id)}.{" "}
                          <span className="font-mono">{item.key}</span>
                          {resolved.importance === "high" ? (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                              重要／高頻
                            </span>
                          ) : null}
                          {resolved.hasFullExplanation ? (
                            <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-900">
                              完整解析
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                          {item.question}
                        </p>
                        {(() => {
                          const tags = extractConceptTags({
                            question: item.question,
                            keywords: item.keywords,
                            category: item.category,
                          });
                          if (tags.length === 0) return null;
                          return (
                            <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                              <span className="text-[var(--muted)]">概念標籤：</span>
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded border border-[var(--border)] bg-slate-50 px-1.5 py-0.5 text-[var(--fg)]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </p>
                          );
                        })()}
                        {resolved.hintAnswer ? (
                          <details className="mt-2 text-sm">
                            <summary className="cursor-pointer text-[var(--accent)]">
                              {explanationDisplayLabel(resolved.hasFullExplanation)}
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap text-[var(--muted)]">
                              {resolved.hintAnswer}
                            </p>
                          </details>
                        ) : null}
                      </li>
                    );
                  })}
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
