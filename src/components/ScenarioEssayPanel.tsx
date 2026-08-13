"use client";

import { useMemo, useState } from "react";

import {
  RUBRIC_WEIGHTS,
  type ScenarioEssayGradeResult,
} from "@/lib/scenario-essay-types";
import type { ScenarioEssayQuestion } from "@/lib/scenario-essay-bank";

type QuestionListItem = Pick<ScenarioEssayQuestion, "id" | "title" | "prompt" | "tags">;

type ScenarioEssayPanelProps = {
  questions: QuestionListItem[];
  signedIn: boolean;
};

const DIM_LABEL: Record<keyof typeof RUBRIC_WEIGHTS, string> = {
  citation: "法條引用正確性",
  procedure: "處置程序合法性",
  coherence: "邏輯連貫與公文用語",
};

export function ScenarioEssayPanel({ questions, signedIn }: ScenarioEssayPanelProps) {
  const [questionId, setQuestionId] = useState(questions[0]?.id ?? "");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioEssayGradeResult | null>(null);

  const current = useMemo(
    () => questions.find((q) => q.id === questionId) ?? questions[0] ?? null,
    [questions, questionId],
  );

  async function submit() {
    if (!signedIn) {
      setError("請先登入後再送出批改");
      return;
    }
    if (!current) {
      setError("尚無可用題目");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/scenario-essay/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: current.id, userAnswer: answer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "批改失敗");
        return;
      }
      setResult(data as ScenarioEssayGradeResult);
    } catch {
      setError("無法連線，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm text-[var(--muted)]">目前沒有情境申論題。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">採購實務情境申論題</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          Rubric-Based LLM 批改：法條引用正確性（30%）、處置程序合法性（40%）、邏輯連貫與公文用語（30%）。
          送出後取得 JSON 結構化得分、扣分項、優點與修正後示範回答。
        </p>

        <label className="mt-5 block text-sm font-medium">選擇題目</label>
        <select
          className="mt-1 w-full max-w-2xl rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
          value={current?.id}
          onChange={(e) => {
            setQuestionId(e.target.value);
            setResult(null);
            setError(null);
          }}
        >
          {questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title}
            </option>
          ))}
        </select>

        {current ? (
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 p-4">
            <h2 className="text-sm font-semibold">{current.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{current.prompt}</p>
            {current.tags.length > 0 ? (
              <p className="mt-3 text-xs text-[var(--muted)]">標籤：{current.tags.join("、")}</p>
            ) : null}
          </div>
        ) : null}

        <label className="mt-5 block text-sm font-medium">您的申論作答</label>
        <textarea
          className="mt-1 min-h-[200px] w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm leading-relaxed"
          placeholder="請以機關承辦立場撰寫：法條依據、契約對照、處置程序與注意事項…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={6000}
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>{answer.trim().length} 字（建議 150 字以上）</span>
          {!signedIn ? <span>需登入後批改</span> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading || !signedIn}
            onClick={() => void submit()}
            className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "批改中…" : "送出 AI 批改"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setAnswer("");
              setResult(null);
              setError(null);
            }}
            className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:underline"
          >
            清除作答
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <p className="mt-3 text-sm text-amber-900">
            正在依 Rubric 檢索法規並呼叫 AI 批改，請稍候…
          </p>
        ) : null}
      </div>

      {result ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">批改結果</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                模型：{result.model}
                {result.fallback ? "（離線／備援評分）" : ""}
              </p>
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              {result.total}
              <span className="ml-1 text-sm font-normal text-[var(--muted)]">／100</span>
            </p>
          </div>

          <ul className="mt-5 space-y-3">
            {(Object.keys(RUBRIC_WEIGHTS) as Array<keyof typeof RUBRIC_WEIGHTS>).map((key) => {
              const dim = result.scores[key];
              const pct = dim.max > 0 ? Math.round((dim.score / dim.max) * 100) : 0;
              return (
                <li key={key} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {DIM_LABEL[key]}
                      <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                        權重 {RUBRIC_WEIGHTS[key]}%
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">
                      {dim.score}/{dim.max}（{pct}%）
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-gray-100">
                    <div
                      className="h-full bg-teal-700/80"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {dim.comment ? (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{dim.comment}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {result.strengths.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-emerald-950">優點</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-950">
                {result.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.deductions.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-amber-950">扣分項</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
                {result.deductions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 rounded-lg border border-sky-200 bg-sky-50/60 p-4">
            <h3 className="text-sm font-semibold text-sky-950">修正後示範回答</h3>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-sky-950">
              {result.modelAnswer}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
