"use client";

import { useEffect, useMemo, useState } from "react";

import {
  assembleGuidedPrompt,
  defaultSlotValues,
  validateSlotValues,
  type GuidedScenario,
} from "@/lib/guided-prompts";

type GuidedSlotFormProps = {
  scenario: GuidedScenario;
  disabled?: boolean;
  onCancel: () => void;
  onAssemble: (prompt: string) => void;
};

export function GuidedSlotForm({
  scenario,
  disabled = false,
  onCancel,
  onAssemble,
}: GuidedSlotFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    defaultSlotValues(scenario),
  );
  const [ask, setAsk] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(defaultSlotValues(scenario));
    setAsk("");
    setError(null);
  }, [scenario.id]);

  const preview = useMemo(() => {
    try {
      return assembleGuidedPrompt({ scenario, values, ask });
    } catch {
      return "";
    }
  }, [scenario, values, ask]);

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function submit() {
    const err = validateSlotValues(scenario, values);
    if (err) {
      setError(err);
      return;
    }
    if (!ask.trim()) {
      setError("請填寫「想請教」或點選下方提示詞範例");
      return;
    }
    onAssemble(assembleGuidedPrompt({ scenario, values, ask }));
  }

  return (
    <div
      className="mt-4 rounded-lg border border-sky-200 bg-white p-4 shadow-sm"
      role="dialog"
      aria-labelledby={`guided-slot-${scenario.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`guided-slot-${scenario.id}`} className="text-sm font-semibold text-sky-950">
            填寫案情欄位｜{scenario.title}
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            選擇標的、金額級距等資訊後，系統會組裝成結構化提問，提升回答精準度。
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="text-xs text-[var(--muted)] underline-offset-2 hover:underline disabled:opacity-60"
        >
          關閉
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {scenario.slots.map((slot) => (
          <label key={slot.key} className="block text-xs font-medium text-[var(--fg)]">
            {slot.label}
            {slot.required ? <span className="text-red-600"> *</span> : null}
            {slot.type === "select" ? (
              <select
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-2 text-sm font-normal"
                value={values[slot.key] ?? ""}
                disabled={disabled}
                onChange={(e) => setField(slot.key, e.target.value)}
              >
                <option value="">請選擇</option>
                {(slot.options ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={slot.type === "amount" ? "number" : "text"}
                inputMode={slot.type === "amount" ? "decimal" : "text"}
                min={slot.type === "amount" ? 0 : undefined}
                step={slot.type === "amount" ? "any" : undefined}
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-2 text-sm font-normal"
                placeholder={slot.placeholder}
                value={values[slot.key] ?? ""}
                disabled={disabled}
                onChange={(e) => setField(slot.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-[var(--fg)]">提示詞範例（點選帶入「想請教」）</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {scenario.starters.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => {
                setAsk(s);
                setError(null);
              }}
              className={
                ask === s
                  ? "rounded-md border border-sky-400 bg-sky-50 px-2.5 py-1.5 text-left text-xs leading-snug"
                  : "rounded-md border border-[var(--border)] bg-slate-50 px-2.5 py-1.5 text-left text-xs leading-snug hover:border-sky-300 hover:bg-sky-50 disabled:opacity-60"
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 block text-xs font-medium text-[var(--fg)]">
        想請教 <span className="text-red-600">*</span>
        <textarea
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-2 text-sm font-normal leading-relaxed"
          rows={3}
          value={ask}
          disabled={disabled}
          placeholder="可點選上方範例，或自行輸入問題…"
          onChange={(e) => {
            setAsk(e.target.value);
            setError(null);
          }}
        />
      </label>

      <details className="mt-3 rounded-md border border-dashed border-[var(--border)] bg-slate-50/80 px-3 py-2">
        <summary className="cursor-pointer text-xs text-[var(--muted)]">預覽將組裝的 Prompt</summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-[var(--fg)]">
          {preview}
        </pre>
      </details>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={submit}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          組裝並帶入問題框
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCancel}
          className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
        >
          取消
        </button>
      </div>
    </div>
  );
}
