"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ExamDiagnosticItem } from "@/lib/exam-diagnostics-types";
import { formatAnswerLabel } from "@/lib/mock-exam";

type ExamDiagnosticsPanelProps = {
  sessionId: string | null;
  /** 交卷後自動開始診斷 */
  autoStart?: boolean;
  questionType?: string;
  /** 伺服器端已載入的診斷（場次詳情頁） */
  initialItems?: ExamDiagnosticItem[];
};

export function ExamDiagnosticsPanel({
  sessionId,
  autoStart = false,
  questionType = "MULTIPLE_CHOICE",
  initialItems,
}: ExamDiagnosticsPanelProps) {
  const [items, setItems] = useState<ExamDiagnosticItem[]>(initialItems ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [started, setStarted] = useState(Boolean(initialItems?.length));

  async function runDiagnose(force = false) {
    if (!sessionId) {
      setError("尚無測驗場次，無法診斷");
      return;
    }
    setLoading(true);
    setError(null);
    setStarted(true);
    try {
      const res = await fetch("/api/mock-exam/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, force }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "錯題診斷失敗");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setSkipped(typeof data.skipped === "number" ? data.skipped : 0);
    } catch {
      setError("無法連線，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoStart || !sessionId || initialItems?.length) return;
    void runDiagnose(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when session ready
  }, [autoStart, sessionId]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">AI 錯題診斷</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            針對答錯題目生成觀念釐清與補強條文清單（依知識庫檢索，非法條原文保證）。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runDiagnose(items.length > 0 && skipped === 0)}
          disabled={loading || !sessionId}
          className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading
            ? "診斷中…"
            : skipped > 0
              ? "繼續診斷其餘錯題"
              : items.length > 0
                ? "重新診斷"
                : "開始診斷"}
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--muted)]">正在分析錯題並檢索補強法規，請稍候…</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {!loading && started && !error && items.length === 0 ? (
        <p className="mt-4 text-sm text-green-700">本場沒有可診斷的錯題，或尚未完成評分。</p>
      ) : null}

      {skipped > 0 ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          錯題較多，本次先診斷前 {items.length} 題，其餘 {skipped} 題可按「重新診斷」繼續。
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-5 space-y-5">
          {items.map((item) => (
            <li key={item.answerId} className="border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
              <div className="text-xs text-[var(--muted)]">
                第 {item.questionIndex + 1} 題 · {item.category}
              </div>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{item.question}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                您的答案：{formatAnswerLabel(item.userAnswer, questionType)}
                {" · "}
                參考答案：{formatAnswerLabel(item.referenceAnswer, questionType)}
              </p>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg)]">
                {item.clarification}
              </div>
              {item.regulations.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-[var(--muted)]">補強法規清單</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {item.regulations.map((r) => (
                      <li key={r.slug}>
                        <Link
                          href={`/regulations#${r.slug}`}
                          className="text-[var(--accent)] no-underline hover:underline"
                        >
                          《{r.title}》
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
