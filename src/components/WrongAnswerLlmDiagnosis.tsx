"use client";

import { useEffect, useMemo, useState } from "react";

import { parseDiagnosticSections } from "@/lib/diagnostic-sections";

type Props = {
  itemKey: string;
  userAnswer: string;
  /** 僅在答錯時啟用 */
  enabled: boolean;
  /** true：掛載後自動請求；false：顯示按鈕 */
  autoStart?: boolean;
  className?: string;
};

/**
 * 階段 1：答錯後顯示 LLM 動態認知誤區／適用條件差異（固定解析之外）。
 */
export function WrongAnswerLlmDiagnosis({
  itemKey,
  userAnswer,
  enabled,
  autoStart = true,
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [startedFor, setStartedFor] = useState<string | null>(null);

  const sections = useMemo(
    () => (analysis ? parseDiagnosticSections(analysis) : null),
    [analysis],
  );

  const requestKey = `${itemKey}::${userAnswer}`;

  async function run() {
    if (!userAnswer) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/question-bank/diagnose-wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey, userAnswer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "AI 診斷失敗");
        return;
      }
      if (data.isCorrect === true) {
        setAnalysis(null);
        return;
      }
      setAnalysis(typeof data.analysis === "string" ? data.analysis : "");
      setModel(typeof data.model === "string" ? data.model : null);
    } catch {
      setError("無法連線，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!enabled || !autoStart) return;
    if (!userAnswer) return;
    if (startedFor === requestKey) return;
    setStartedFor(requestKey);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在題／答案變更時自動啟動
  }, [enabled, autoStart, requestKey, userAnswer]);

  if (!enabled) return null;

  const hasStructured =
    sections &&
    (sections.cognitiveMisconception ||
      sections.applicabilityDiff ||
      sections.weaknessAnalysis ||
      sections.wrongReasonAnalysis);

  return (
    <div
      className={`rounded-lg border border-violet-200 bg-violet-50/90 p-4 text-sm text-violet-950 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">AI 動態錯題診斷</p>
        {!autoStart || error ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void run()}
            className="rounded-md border border-violet-300 bg-white px-2.5 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
          >
            {loading ? "分析中…" : analysis ? "重新分析" : "產生 AI 診斷"}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-violet-900/75">
        除固定解析外，分析您所選選項的常見認知誤區，並用兩句話對照正確答案與錯誤選項在採購法適用條件上的差異。
      </p>

      {loading && !analysis ? (
        <p className="mt-3 text-xs text-violet-800">正在產生認知誤區與適用條件差異分析…</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {hasStructured ? (
        <div className="mt-3 space-y-3 text-xs leading-relaxed">
          {sections!.cognitiveMisconception ? (
            <div>
              <p className="font-semibold text-violet-950">認知誤區</p>
              <p className="mt-1 whitespace-pre-wrap text-violet-900/90">
                {sections!.cognitiveMisconception}
              </p>
            </div>
          ) : null}
          {sections!.applicabilityDiff ? (
            <div>
              <p className="font-semibold text-violet-950">適用條件差異（2 句對照）</p>
              <p className="mt-1 whitespace-pre-wrap text-violet-900/90">
                {sections!.applicabilityDiff}
              </p>
            </div>
          ) : null}
          {sections!.weaknessAnalysis ? (
            <div>
              <p className="font-semibold text-violet-950">弱點提示</p>
              <p className="mt-1 whitespace-pre-wrap text-violet-900/90">
                {sections!.weaknessAnalysis}
              </p>
            </div>
          ) : null}
          {!sections!.cognitiveMisconception && sections!.wrongReasonAnalysis ? (
            <div>
              <p className="font-semibold text-violet-950">錯題原因分析</p>
              <p className="mt-1 whitespace-pre-wrap text-violet-900/90">
                {sections!.wrongReasonAnalysis}
              </p>
            </div>
          ) : null}
          {model && model !== "none" ? (
            <p className="text-[11px] text-violet-800/70">模型：{model}</p>
          ) : null}
        </div>
      ) : analysis ? (
        <p className="mt-3 whitespace-pre-wrap text-xs text-violet-900/90">{analysis}</p>
      ) : null}
    </div>
  );
}
