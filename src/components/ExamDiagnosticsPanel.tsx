"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  DiagnosticRegulation,
  ExamSessionDiagnosis,
  WrongQuestionBrief,
} from "@/lib/exam-diagnostics-types";
import { formatAnswerLabel } from "@/lib/mock-exam";

type ExamDiagnosticsPanelProps = {
  sessionId: string | null;
  autoStart?: boolean;
  questionType?: string;
  initialDiagnosis?: ExamSessionDiagnosis | null;
};

export function ExamDiagnosticsPanel({
  sessionId,
  autoStart = false,
  questionType = "MULTIPLE_CHOICE",
  initialDiagnosis = null,
}: ExamDiagnosticsPanelProps) {
  const [summary, setSummary] = useState(initialDiagnosis?.summary ?? "");
  const [recommendations, setRecommendations] = useState<DiagnosticRegulation[]>(
    initialDiagnosis?.recommendations ?? [],
  );
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestionBrief[]>(
    initialDiagnosis?.wrongQuestions ?? [],
  );
  const [wrongCount, setWrongCount] = useState(initialDiagnosis?.wrongCount ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(Boolean(initialDiagnosis?.summary));

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
      setSummary(typeof data.summary === "string" ? data.summary : "");
      setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      setWrongQuestions(Array.isArray(data.wrongQuestions) ? data.wrongQuestions : []);
      setWrongCount(typeof data.wrongCount === "number" ? data.wrongCount : 0);
    } catch {
      setError("無法連線，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoStart || !sessionId || initialDiagnosis?.summary) return;
    void runDiagnose(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-run once when session is ready
  }, [autoStart, sessionId]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">AI 錯題綜合診斷</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            交卷後針對答錯題目進行綜合觀念診斷，並自動推薦需補強的法規條文（依知識庫檢索）。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runDiagnose(Boolean(summary))}
          disabled={loading || !sessionId}
          className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "診斷中…" : summary ? "重新診斷" : "開始診斷"}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          正在彙整錯題、檢索法規並呼叫 AI 產生綜合診斷，請稍候…
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {!loading && started && !error && wrongCount === 0 && summary ? (
        <p className="mt-4 text-sm text-green-700">{summary}</p>
      ) : null}

      {!loading && summary && wrongCount > 0 ? (
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold">綜合觀念診斷</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">本場答錯 {wrongCount} 題</p>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
          </div>

          {recommendations.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold">建議補強法規</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {recommendations.map((r) => (
                  <li key={r.slug} className="border-b border-[var(--border)] pb-2 last:border-b-0">
                    <Link
                      href={`/regulations#${r.slug}`}
                      className="font-medium text-[var(--accent)] no-underline hover:underline"
                    >
                      《{r.title}》
                    </Link>
                    {r.reason ? (
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{r.reason}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {wrongQuestions.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold">錯題一覽</h3>
              <ul className="mt-2 space-y-3">
                {wrongQuestions.map((w) => (
                  <li key={w.itemKey} className="text-sm">
                    <div className="text-xs text-[var(--muted)]">
                      第 {w.questionIndex + 1} 題 · {w.category}
                    </div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{w.question}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      您的答案：{formatAnswerLabel(w.userAnswer, questionType)}
                      {" · "}
                      參考答案：{formatAnswerLabel(w.referenceAnswer, questionType)}
                    </p>
                    {w.diagnosticNote ? (
                      <p className="mt-1 text-xs leading-relaxed text-[var(--fg)]">
                        {w.diagnosticNote}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
