"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { KnowledgeRadarChart } from "@/components/KnowledgeRadarChart";
import { parseDiagnosticSections } from "@/lib/diagnostic-sections";
import type {
  DiagnosticRegulation,
  ExamSessionDiagnosis,
  WrongQuestionBrief,
} from "@/lib/exam-diagnostics-types";
import type { KnowledgeRadarSnapshot } from "@/lib/knowledge-radar";
import { formatAnswerLabel } from "@/lib/mock-exam";

type ExamDiagnosticsPanelProps = {
  sessionId: string | null;
  autoStart?: boolean;
  questionType?: string;
  initialDiagnosis?: ExamSessionDiagnosis | null;
  /** 交卷後即可先顯示的確定性雷達（尚未呼叫 LLM 時） */
  initialRadar?: KnowledgeRadarSnapshot | null;
};

export function ExamDiagnosticsPanel({
  sessionId,
  autoStart = false,
  questionType = "MULTIPLE_CHOICE",
  initialDiagnosis = null,
  initialRadar = null,
}: ExamDiagnosticsPanelProps) {
  const [summary, setSummary] = useState(initialDiagnosis?.summary ?? "");
  const [recommendations, setRecommendations] = useState<DiagnosticRegulation[]>(
    initialDiagnosis?.recommendations ?? [],
  );
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestionBrief[]>(
    initialDiagnosis?.wrongQuestions ?? [],
  );
  const [wrongCount, setWrongCount] = useState(initialDiagnosis?.wrongCount ?? 0);
  const [radar, setRadar] = useState<KnowledgeRadarSnapshot | null>(
    initialDiagnosis?.radar ?? initialRadar,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(Boolean(initialDiagnosis?.summary));

  const sections = useMemo(() => parseDiagnosticSections(summary), [summary]);

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
      if (data.radar && typeof data.radar === "object") {
        setRadar(data.radar as KnowledgeRadarSnapshot);
      }
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
          <h2 className="text-base font-semibold">AI 錯題原因與弱點分析</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            結合模擬考試作答與題庫知識標籤：規則引擎先算弱點雷達，再由 AI
            產出弱點分析與逐題錯題原因。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runDiagnose(Boolean(summary))}
          disabled={loading || !sessionId}
          className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "分析中…" : summary ? "重新分析" : "開始分析"}
        </button>
      </div>

      {radar ? (
        <div className="mt-5 rounded-lg border border-[var(--border)] p-4">
          <h3 className="text-sm font-semibold">弱點雷達（確定性）</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            依題庫知識標籤統計本場正答／錯題，不經 LLM 改寫。
          </p>
          <div className="mt-3">
            <KnowledgeRadarChart radar={radar} compact />
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          正在依弱點標籤檢索法規並呼叫 AI 產生弱點分析與錯題原因，請稍候…
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {!loading && started && !error && wrongCount === 0 && summary ? (
        <p className="mt-4 text-sm text-green-700">{summary}</p>
      ) : null}

      {!loading && summary && wrongCount > 0 ? (
        <div className="mt-5 space-y-5">
          {sections.weaknessAnalysis ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <h3 className="text-sm font-semibold text-amber-950">弱點分析</h3>
              <p className="mt-1 text-xs text-amber-900/80">本場答錯 {wrongCount} 題</p>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-amber-950">
                {sections.weaknessAnalysis}
              </div>
            </div>
          ) : null}

          {sections.wrongReasonAnalysis ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4">
              <h3 className="text-sm font-semibold text-sky-950">錯題原因分析</h3>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-sky-950">
                {sections.wrongReasonAnalysis}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold">AI 診斷全文</h3>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
            </div>
          )}

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
              <h3 className="text-sm font-semibold">錯題一覽（題庫連結）</h3>
              <ul className="mt-2 space-y-3">
                {wrongQuestions.map((w) => (
                  <li key={w.itemKey} className="text-sm">
                    <div className="text-xs text-[var(--muted)]">
                      第 {w.questionIndex + 1} 題 ·{" "}
                      <Link
                        href={`/question-bank?category=${encodeURIComponent(w.category)}&q=${encodeURIComponent(w.itemKey)}`}
                        className="no-underline hover:underline"
                      >
                        {w.category}
                      </Link>
                      {w.knowledgeTags.length > 0
                        ? ` · ${w.knowledgeTags.join("、")}`
                        : ""}
                    </div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{w.question}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      您的答案：{formatAnswerLabel(w.userAnswer, questionType)}
                      {" · "}
                      參考答案：{formatAnswerLabel(w.referenceAnswer, questionType)}
                    </p>
                    {w.diagnosticNote ? (
                      <p className="mt-1 rounded-md bg-sky-50 px-2 py-1.5 text-xs leading-relaxed text-sky-950">
                        <span className="font-medium">錯題原因：</span>
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
