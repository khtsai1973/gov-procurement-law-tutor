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
import {
  buildCapabilityMatrix,
  STRONG_PCT_THRESHOLD,
  type KnowledgeRadarSnapshot,
} from "@/lib/knowledge-radar";
import type {
  PersonalWeaknessReport,
  PracticeQuestionBrief,
} from "@/lib/personal-weakness-report";
import { PERSONAL_WEAKNESS_REPORT_TITLE } from "@/lib/personal-weakness-report";
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
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestionBrief[]>(
    initialDiagnosis?.practiceQuestions ?? [],
  );
  const [personalReport, setPersonalReport] = useState<PersonalWeaknessReport | null>(
    initialDiagnosis?.personalReport ?? null,
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
  const matrix = useMemo(() => (radar ? buildCapabilityMatrix(radar) : []), [radar]);

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
      setPracticeQuestions(Array.isArray(data.practiceQuestions) ? data.practiceQuestions : []);
      setPersonalReport(
        data.personalReport && typeof data.personalReport === "object"
          ? (data.personalReport as PersonalWeaknessReport)
          : null,
      );
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

  const coreStrengthText =
    sections.coreStrengths ||
    personalReport?.coreStrengths.map((s) => `- ${s}`).join("\n") ||
    "";
  const keyWeakText =
    sections.keyWeaknesses ||
    sections.weaknessAnalysis ||
    personalReport?.keyWeaknesses.map((s) => `- ${s}`).join("\n") ||
    "";
  const actionText = sections.actionAdvice || sections.regulationAdvice || "";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">《{PERSONAL_WEAKNESS_REPORT_TITLE}》</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            題目標籤（知識軸／條次／概念）→ 能力矩陣 → 錯題標籤知識圖譜分析，產出核心強項、關鍵弱點與行動建議。
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
          <h3 className="text-sm font-semibold">能力矩陣（確定性）</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            依題庫知識軸統計本場正確率；核心強項門檻 ≥ {STRONG_PCT_THRESHOLD}%，不經 LLM 改寫。
          </p>
          {matrix.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              {matrix.map((m) => (
                <li
                  key={m.tag}
                  className={
                    m.role === "strength"
                      ? "rounded-md bg-emerald-50 px-2 py-1 text-emerald-900"
                      : m.role === "weakness"
                        ? "rounded-md bg-amber-50 px-2 py-1 text-amber-950"
                        : "rounded-md bg-gray-50 px-2 py-1 text-gray-700"
                  }
                >
                  {m.tag} {m.pct}%
                  {m.role === "strength" ? " · 強項" : m.role === "weakness" ? " · 弱點" : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3">
            <KnowledgeRadarChart radar={radar} compact />
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          正在將錯題標籤送入 AI 進行知識圖譜分析，生成《{PERSONAL_WEAKNESS_REPORT_TITLE}》…
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {!loading && started && !error && wrongCount === 0 && summary ? (
        <p className="mt-4 text-sm text-green-700">{summary}</p>
      ) : null}

      {!loading && summary && wrongCount > 0 ? (
        <div className="mt-5 space-y-5">
          {coreStrengthText ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
              <h3 className="text-sm font-semibold text-emerald-950">核心強項</h3>
              <p className="mt-1 text-xs text-emerald-900/80">
                正確率 ≥ {STRONG_PCT_THRESHOLD}%
              </p>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-emerald-950">
                {coreStrengthText}
              </div>
            </div>
          ) : null}

          {keyWeakText ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <h3 className="text-sm font-semibold text-amber-950">關鍵弱點</h3>
              <p className="mt-1 text-xs text-amber-900/80">本場答錯 {wrongCount} 題</p>
              {personalReport && personalReport.wrongConceptTags.length > 0 ? (
                <p className="mt-2 text-xs text-amber-900/90">
                  錯題標籤：{personalReport.wrongConceptTags.slice(0, 12).join("、")}
                </p>
              ) : null}
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-amber-950">
                {keyWeakText}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4">
            <h3 className="text-sm font-semibold text-teal-950">行動建議</h3>
            <p className="mt-1 text-xs text-teal-900/80">
              3 條補強法規連結＋2 道精準推薦練習題
            </p>
            {actionText ? (
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-teal-950">
                {actionText}
              </div>
            ) : null}

            {recommendations.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-teal-950">補強法條連結</h4>
                <ul className="mt-2 space-y-2 text-sm">
                  {recommendations.slice(0, 3).map((r) => (
                    <li key={r.slug} className="border-b border-teal-100 pb-2 last:border-b-0">
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

            {practiceQuestions.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-teal-950">精準推薦練習題</h4>
                <ul className="mt-2 space-y-3 text-sm">
                  {practiceQuestions.slice(0, 2).map((p) => (
                    <li key={p.key}>
                      <Link
                        href={`/question-bank?category=${encodeURIComponent(p.category)}&q=${encodeURIComponent(p.key)}`}
                        className="font-medium text-[var(--accent)] no-underline hover:underline"
                      >
                        {p.category}
                      </Link>
                      {p.tags.length > 0 ? (
                        <span className="ml-2 text-xs text-[var(--muted)]">
                          {p.tags.slice(0, 4).join("、")}
                        </span>
                      ) : null}
                      <p className="mt-1 line-clamp-2 text-teal-950">{p.question}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {sections.wrongReasonAnalysis ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4">
              <h3 className="text-sm font-semibold text-sky-950">錯題原因分析</h3>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-sky-950">
                {sections.wrongReasonAnalysis}
              </div>
            </div>
          ) : !coreStrengthText && !keyWeakText ? (
            <div>
              <h3 className="text-sm font-semibold">AI 診斷全文</h3>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
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
