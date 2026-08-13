"use client";

import { useState } from "react";

import { WrongAnswerLlmDiagnosis } from "@/components/WrongAnswerLlmDiagnosis";

type Props = {
  itemKey: string;
  /** 若已知參考答案選項（1-4），可顯示對錯；否則仍可送出分析 */
  enabled?: boolean;
};

/** 題庫練習：先選答案，再觸發階段 1 LLM 動態錯題診斷 */
export function QuestionWrongReasonPractice({ itemKey, enabled = true }: Props) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!enabled) return null;

  return (
    <div className="mt-3 rounded-md border border-dashed border-[var(--border)] bg-slate-50/80 px-3 py-3">
      <p className="text-xs font-medium text-[var(--fg)]">AI 動態錯題診斷（題庫練習）</p>
      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
        選擇您認為的答案後送出；若答錯，將分析認知誤區，並用兩句話對照正確／錯誤選項的適用條件差異。
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(["1", "2", "3", "4"] as const).map((v) => (
          <label
            key={v}
            className={`cursor-pointer rounded border px-2.5 py-1 text-xs ${
              answer === v
                ? "border-violet-400 bg-violet-50 text-violet-950"
                : "border-[var(--border)] bg-white text-[var(--muted)]"
            }`}
          >
            <input
              type="radio"
              name={`ans-${itemKey}`}
              value={v}
              checked={answer === v}
              onChange={() => {
                setAnswer(v);
                setSubmitted(false);
              }}
              className="sr-only"
            />
            選項 ({v})
          </label>
        ))}
        <button
          type="button"
          disabled={!answer}
          onClick={() => setSubmitted(true)}
          className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
        >
          送出並診斷
        </button>
      </div>

      {submitted && answer ? (
        <WrongAnswerLlmDiagnosis
          className="mt-3"
          itemKey={itemKey}
          userAnswer={answer}
          enabled
          autoStart
        />
      ) : null}
    </div>
  );
}
