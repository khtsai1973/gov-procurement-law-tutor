"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { extractConceptTags } from "@/lib/concept-tags";
import {
  QUESTION_BANK_PAGE_SIZE,
  isDefaultQuestionBankQuery,
  questionBankHref,
  type QuestionBankListItem,
  type QuestionBankListQuery,
  type QuestionBankListResult,
} from "@/lib/question-bank-list";
import { QuestionBankSignedInOnly } from "@/components/QuestionBankUserSection";
import { QuestionWrongReasonPractice } from "@/components/QuestionWrongReasonPractice";

type Props = {
  totalCount: number;
  initialData: QuestionBankListResult;
};

function LazyExplanation({
  itemKey,
  hasHint,
  hasFullExplanation,
}: {
  itemKey: string;
  hasHint: boolean;
  hasFullExplanation: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!hasHint) return null;

  async function loadIfNeeded() {
    if (text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/question-bank/explanation?key=${encodeURIComponent(itemKey)}`,
        { headers: { Accept: "application/json" } },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "解析載入失敗");
        return;
      }
      setText(data.explanation?.hintAnswer ?? "");
    } catch {
      setError("無法連線，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details
      className="mt-2 text-sm"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) void loadIfNeeded();
      }}
    >
      <summary className="cursor-pointer text-[var(--accent)]">
        {hasFullExplanation ? "完整解析" : "解答提示"}
      </summary>
      {loading && !text ? (
        <p className="mt-2 text-[var(--muted)]">載入解析中…</p>
      ) : null}
      {error ? <p className="mt-2 text-red-600">{error}</p> : null}
      {text ? (
        <p className="mt-2 whitespace-pre-wrap text-[var(--muted)]">{text}</p>
      ) : null}
    </details>
  );
}

type ListViewProps = {
  totalCount: number;
  data: QuestionBankListResult | null;
  query: QuestionBankListQuery;
  loading?: boolean;
  error?: string | null;
};

export function QuestionBankListView({
  totalCount,
  data,
  query,
  loading = false,
  error = null,
}: ListViewProps) {
  const { category, q, important, page } = query;
  const byCategory: [string, QuestionBankListItem[]][] = [];
  if (data?.items.length) {
    const map = new Map<string, QuestionBankListItem[]>();
    for (const item of data.items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    byCategory.push(...map.entries());
  }
  const indexById = new Map<string, number>();
  (data?.items ?? []).forEach((item, i) => {
    indexById.set(item.id, ((data?.page ?? page) - 1) * QUESTION_BANK_PAGE_SIZE + i + 1);
  });
  const safePage = data?.page ?? page;
  const totalPages = data?.totalPages ?? 1;
  const filteredCount = data?.filteredCount ?? 0;
  const showFilteredCount = !loading && filteredCount !== totalCount && filteredCount > 0;

  return (
    <>
      {showFilteredCount ? (
        <p className="text-xs text-[var(--muted)]">目前符合 {filteredCount} 題</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={questionBankHref({ category, q, important: !important })}
          className={`rounded-md border px-2.5 py-1 text-xs no-underline ${
            important
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-[var(--border)] bg-white text-[var(--muted)] hover:bg-slate-50"
          }`}
        >
          {important ? "顯示全部題目" : "只看重要／高頻（含完整解析）"}
        </Link>
        {category ? (
          <Link
            href={questionBankHref({ q, important })}
            className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs text-[var(--muted)] no-underline hover:bg-slate-50"
          >
            清除分類「{category}」
          </Link>
        ) : null}
        {q ? (
          <Link
            href={questionBankHref({ category, important })}
            className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs text-[var(--muted)] no-underline hover:bg-slate-50"
          >
            清除搜尋「{q}」
          </Link>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-6 min-h-[24rem] text-sm text-[var(--muted)]">載入題目中…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-amber-900">
          題庫資料讀取失敗。請確認已執行資料庫初始化與題庫匯入。
          <span className="mt-1 block break-all text-xs text-amber-800/80">{error}</span>
        </p>
      ) : !data || data.items.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">沒有符合的題目。</p>
      ) : (
        <div className="mt-6 space-y-6">
          {byCategory.map(([cat, items]) => (
            <div
              key={cat}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
            >
              <h2 className="text-base font-semibold">{cat}</h2>
              <ul className="mt-4 space-y-4">
                {items.map((item) => {
                  const index = indexById.get(item.id) ?? 0;
                  const tags = extractConceptTags({
                    question: item.question,
                    keywords: item.keywords,
                    category: item.category,
                  });
                  return (
                    <li
                      key={item.id}
                      className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="text-xs text-[var(--muted)]">
                        {index}. <span className="font-mono">{item.key}</span>
                        {item.importance === "high" ? (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                            重要／高頻
                          </span>
                        ) : null}
                        {item.hasFullExplanation ? (
                          <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-900">
                            完整解析
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                        {item.question}
                      </p>
                      {tags.length > 0 ? (
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
                      ) : null}
                      <LazyExplanation
                        itemKey={item.key}
                        hasHint={item.hasHint}
                        hasFullExplanation={item.hasFullExplanation}
                      />
                      <QuestionBankSignedInOnly>
                        <QuestionWrongReasonPractice itemKey={item.key} />
                      </QuestionBankSignedInOnly>
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
                  <Link
                    href={questionBankHref({ category, q, important, page: safePage - 1 })}
                    className="no-underline hover:underline"
                  >
                    上一頁
                  </Link>
                ) : null}
                {safePage < totalPages ? (
                  <Link
                    href={questionBankHref({ category, q, important, page: safePage + 1 })}
                    className="no-underline hover:underline"
                  >
                    下一頁
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

export function QuestionBankBrowser({ totalCount, initialData }: Props) {
  const searchParams = useSearchParams();
  const category = searchParams.get("category")?.trim() ?? "";
  const q = searchParams.get("q")?.trim() ?? "";
  const important = searchParams.get("important") === "1" || searchParams.get("important") === "true";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const useInitial = isDefaultQuestionBankQuery({ category, q, important, page });

  const [data, setData] = useState<QuestionBankListResult | null>(useInitial ? initialData : null);
  const [loading, setLoading] = useState(!useInitial);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    if (important) params.set("important", "1");
    if (page > 1) params.set("page", String(page));
    const s = params.toString();
    return s ? `/api/question-bank/items?${s}` : "/api/question-bank/items";
  }, [category, q, important, page]);

  useEffect(() => {
    if (useInitial) {
      setData(initialData);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(apiUrl, { headers: { Accept: "application/json" } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
        }
        if (!cancelled) {
          setData({
            items: json.items ?? [],
            filteredCount: json.filteredCount ?? 0,
            totalPages: json.totalPages ?? 1,
            page: json.page ?? 1,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "題庫讀取失敗");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, useInitial, initialData]);

  return (
    <QuestionBankListView
      totalCount={totalCount}
      data={data}
      query={{ category, q, important, page }}
      loading={loading}
      error={error}
    />
  );
}
