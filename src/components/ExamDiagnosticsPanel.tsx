"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { KnowledgeRadarChart } from "@/components/KnowledgeRadarChart";
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
          <h2 className="text-base font-semibold">混合診斷（規則雷達 + AI 建議）</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            先以知識標籤規則引擎計算雷達圖數值，再由 AI 依弱點標籤生成個人化補強指引。
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

      {radar ? (
        <div className="mt-5 rounded-lg border border-[var(--border)] p-4">
          <h3 className="text-sm font-semibold">知識標籤雷達圖（確定性）</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            數值由錯題／正答標籤統計而得，不經 LLM 改寫。
          </p>
          <div className="mt-3">
            <KnowledgeRadarChart radar={radar} compact />
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          正在依弱點標籤檢索法規並呼叫 AI 產生語意建議，請稍候…
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {!loading && started && !error && wrongCount === 0 && summary ? (
        <p className="mt-4 text-sm text-green-700">{summary}</p>
      ) : null}

      {!loading && summary && wrongCount > 0 ? (
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold">AI 語意化建議</h3>
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
