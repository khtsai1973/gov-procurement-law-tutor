"use client";

import { useState } from "react";

type FeedbackValue = "UP" | "DOWN";

type AnswerFeedbackProps = {
  questionId: string;
};

export function AnswerFeedback({ questionId }: AnswerFeedbackProps) {
  const [rating, setRating] = useState<FeedbackValue | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextRating: FeedbackValue = rating ?? "UP") {
    if (!questionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          feedback: nextRating,
          comment,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "送出失敗");
        return;
      }
      setRating(nextRating);
      setSubmitted(true);
    } catch {
      setError("無法連線，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  async function onThumb(value: FeedbackValue) {
    setRating(value);
    await submit(value);
  }

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <p className="text-sm font-medium text-[var(--fg)]">回答反饋</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        請以 👍／👎 評分；結果會寫入資料庫，作為模型成效與回答品質指標（管理者可於評估頁查看）。
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={loading}
          aria-pressed={rating === "UP"}
          aria-label="有幫助"
          onClick={() => onThumb("UP")}
          className={`rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
            rating === "UP"
              ? "border-emerald-400 bg-emerald-50 text-emerald-800"
              : "border-[var(--border)] bg-white text-[var(--fg)] hover:border-emerald-300 hover:bg-emerald-50"
          }`}
        >
          👍 有幫助
        </button>
        <button
          type="button"
          disabled={loading}
          aria-pressed={rating === "DOWN"}
          aria-label="需改進"
          onClick={() => onThumb("DOWN")}
          className={`rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
            rating === "DOWN"
              ? "border-rose-400 bg-rose-50 text-rose-800"
              : "border-[var(--border)] bg-white text-[var(--fg)] hover:border-rose-300 hover:bg-rose-50"
          }`}
        >
          👎 需改進
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-xs text-[var(--muted)]" htmlFor={`fb-${questionId}`}>
          簡易回饋（選填）
          <input
            id={`fb-${questionId}`}
            type="text"
            value={comment}
            maxLength={1000}
            disabled={loading}
            onChange={(e) => {
              setComment(e.target.value);
              setSubmitted(false);
            }}
            placeholder="例：條文引用清楚／希望補充金額門檻…"
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--fg)] outline-none ring-blue-200 focus:ring-2 disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          disabled={loading || !rating}
          onClick={() => rating && submit(rating)}
          className="shrink-0 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "送出中…" : "送出回饋"}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {submitted && !error ? (
        <p className="mt-2 text-sm text-emerald-700" role="status">
          感謝您的回饋，已記錄供品質評估使用。
        </p>
      ) : null}
    </div>
  );
}
