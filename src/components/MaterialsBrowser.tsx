"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MaterialInfoFields } from "@/components/MaterialInfoFields";
import { buildMaterialInfoFields } from "@/lib/material-info";
import type {
  PublishedMaterialDetail,
  PublishedMaterialSummary,
} from "@/lib/materials-public";
import { TOPIC_CATEGORY_OPTIONS } from "@/lib/question-bank-categories";
import { groupMaterialsByCategory } from "@/lib/unit-materials";

type Props = {
  materials: PublishedMaterialSummary[];
};

function hrefFor(
  filterCategory: string | null,
  opts: { id?: string; category?: string | null },
) {
  const params = new URLSearchParams();
  const cat = opts.category === undefined ? filterCategory : opts.category;
  if (cat) params.set("category", cat);
  if (opts.id) params.set("id", opts.id);
  const q = params.toString();
  return q ? `/materials?${q}` : "/materials";
}

function formatUpdatedAt(iso: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function MaterialsBrowser({ materials }: Props) {
  const searchParams = useSearchParams();
  const filterCategory = searchParams.get("category")?.trim() || null;
  const urlId = searchParams.get("id")?.trim() || null;
  const availableCategories = useMemo(
    () => TOPIC_CATEGORY_OPTIONS.filter((cat) => materials.some((m) => m.category === cat)),
    [materials],
  );
  const filtered = useMemo(
    () =>
      filterCategory ? materials.filter((m) => m.category === filterCategory) : materials,
    [materials, filterCategory],
  );
  const groups = useMemo(() => groupMaterialsByCategory(filtered), [filtered]);

  const selectedId = useMemo(() => {
    if (urlId && filtered.some((m) => m.id === urlId)) return urlId;
    return filtered[0]?.id ?? null;
  }, [filtered, urlId]);

  const selectedSummary = useMemo(
    () => (selectedId ? materials.find((m) => m.id === selectedId) ?? null : null),
    [materials, selectedId],
  );

  const [detail, setDetail] = useState<PublishedMaterialDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetail(null);
        setError(typeof data.error === "string" ? data.error : "讀取全文失敗");
        return;
      }
      setDetail(data.material as PublishedMaterialDetail);
    } catch {
      setDetail(null);
      setError("無法連線，請稍後再試");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    if (detail?.id === selectedId) return;
    void loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to selection change
  }, [selectedId]);

  const info = useMemo(() => {
    if (detail?.info) return detail.info;
    if (!selectedSummary) return null;
    return buildMaterialInfoFields({
      source: selectedSummary.source,
      createdAt: selectedSummary.createdAt,
      aiGeneratedAt: selectedSummary.aiGeneratedAt,
      reviewedAt: selectedSummary.reviewedAt,
      regulationVersion: selectedSummary.regulationVersion,
      lastRevisionAt: selectedSummary.lastRevisionAt,
      lastRevisionNote: selectedSummary.lastRevisionNote,
    });
  }, [detail, selectedSummary]);

  return (
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
              href={hrefFor(filterCategory, { category: cat })}
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
              <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{group.category}</p>
              <div className="space-y-2">
                {group.items.map((m) => {
                  const active = selectedId === m.id;
                  return (
                    <Link
                      key={m.id}
                      href={hrefFor(filterCategory, { id: m.id, category: filterCategory })}
                      prefetch={false}
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
                      {m.summary ? (
                        <span className="mt-1 block line-clamp-2 text-xs text-[var(--muted)]">
                          {m.summary}
                        </span>
                      ) : null}
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

        {selectedSummary ? (
          <article className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">
                  {selectedSummary.category}
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {selectedSummary.unitCode ? `${selectedSummary.unitCode}｜` : ""}
                  {selectedSummary.title}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {selectedSummary.authorName}｜更新於{" "}
                  {formatUpdatedAt(selectedSummary.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/materials/${selectedSummary.id}/presentation`}
                  className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-800 no-underline hover:bg-indigo-100"
                >
                  簡報 PPTX
                </a>
                <a
                  href={`/api/materials/${selectedSummary.id}/document?format=docx`}
                  className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-900 no-underline hover:bg-sky-100"
                >
                  文件 DOCX
                </a>
                <a
                  href={`/api/materials/${selectedSummary.id}/document?format=pdf`}
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-900 no-underline hover:bg-rose-100"
                >
                  文件 PDF
                </a>
              </div>
            </div>

            {info ? <MaterialInfoFields className="mt-4" info={info} /> : null}

            {selectedSummary.summary ? (
              <p className="mt-3 text-sm text-[var(--muted)]">{selectedSummary.summary}</p>
            ) : null}

            <div className="mt-5">
              {loading && !detail ? (
                <p className="text-sm text-[var(--muted)]">正在載入全文…</p>
              ) : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {detail && detail.id === selectedSummary.id ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{detail.content}</div>
              ) : !loading && !error ? (
                <p className="text-sm text-[var(--muted)]">請稍候，或重新點選教材以載入全文。</p>
              ) : null}
            </div>
          </article>
        ) : (
          <p className="text-sm text-[var(--muted)]">請從左側選擇教材。</p>
        )}
      </div>
    </>
  );
}
