"use client";

import { useMemo, useState } from "react";

import { parseDiagnosticSections } from "@/lib/diagnostic-sections";

type Props = {
  itemKey: string;
  /** 若已知參考答案選項（1-4），可顯示對錯；否則仍可送出分析 */
  enabled?: boolean;
};

export function QuestionWrongReasonPractice({ itemKey, enabled = true }: Props) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [weakTags, setWeakTags] = useState<string[]>([]);

  const sections = useMemo(
    () => (analysis ? parseDiagnosticSections(analysis) : null),
    [analysis],
  );

  async function run() {
    if (!answer) {
      setError("請先選擇您的答案");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/question-bank/diagnose-wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey, userAnswer: answer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "分析失敗");
        return;
      }
      setAnalysis(typeof data.analysis === "string" ? data.analysis : "");
      setIsCorrect(typeof data.isCorrect === "boolean" ? data.isCorrect : null);
      setWeakTags(Array.isArray(data.weakTags) ? data.weakTags.map(String) : []);
    } catch {
      setError("無法連線，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) return null;

  return (
    <div className="mt-3 rounded-md border border-dashed border-[var(--border)] bg-slate-50/80 px-3 py-3">
      <p className="text-xs font-medium text-[var(--fg)]">AI 錯題原因分析（題庫練習）</p>
      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
        選擇答案後可請 AI 對照題庫與法規檢索，說明錯因與弱點提示。
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(["1", "2", "3", "4"] as const).map((v) => (
          <label
            key={v}
            className={`cursor-pointer rounded border px-2.5 py-1 text-xs ${
              answer === v
                ? "border-sky-400 bg-sky-50 text-sky-950"
                : "border-[var(--border)] bg-white text-[var(--muted)]"
            }`}
          >
            <input
              type="radio"
              name={`ans-${itemKey}`}
              value={v}
              checked={answer === v}
              onChange={() => setAnswer(v)}
              className="sr-only"
            />
            選項 ({v})
          </label>
        ))}
        <button
          type="button"
          disabled={loading || !answer}
          onClick={() => void run()}
          className="rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
        >
          {loading ? "分析中…" : "分析錯因／弱點"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {isCorrect === true ? (
        <p className="mt-2 text-xs text-emerald-700">答對了。可再練習同分類高頻題。
        </p>
      ) : null}
      {analysis && isCorrect === false ? (
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-[var(--fg)]">
          {sections?.wrongReasonAnalysis || sections?.weaknessAnalysis ? (
            <>
              {sections.wrongReasonAnalysis ? (
                <div>
                  <p className="font-semibold text-sky-900">錯題原因分析</p>
                  <p className="mt-1 whitespace-pre-wrap text-[var(--muted)]">
                    {sections.wrongReasonAnalysis}
                  </p>
                </div>
              ) : null}
              {sections.weaknessAnalysis ? (
                <div>
                  <p className="font-semibold text-amber-900">弱點提示</p>
                  <p className="mt-1 whitespace-pre-wrap text-[var(--muted)]">
                    {sections.weaknessAnalysis}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="whitespace-pre-wrap text-[var(--muted)]">{analysis}</p>
          )}
          {weakTags.length > 0 ? (
            <p className="text-[var(--muted)]">知識標籤：{weakTags.join("、")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
