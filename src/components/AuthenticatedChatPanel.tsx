"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AnswerFeedback } from "@/components/AnswerFeedback";
import { CitationAnswer } from "@/components/CitationAnswer";
import { CitationChips } from "@/components/CitationChips";
import { CitationSidebar } from "@/components/CitationSidebar";
import type { CitationSource } from "@/lib/citations";
import {
  getGuidedScenario,
  GUIDED_INTRO,
  GUIDED_SCENARIOS,
} from "@/lib/guided-prompts";
import { getPromptSuggestionsByCategory, PROMPT_TIP } from "@/lib/prompt-suggestions";
import { GuidedSlotForm } from "@/components/GuidedSlotForm";

import "./chat-panel.css";

export function AuthenticatedChatPanel() {
  const [question, setQuestion] = useState("");
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [showMoreExamples, setShowMoreExamples] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [sources, setSources] = useState<CitationSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarSource, setSidebarSource] = useState<CitationSource | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!answer) return;
    answerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [answer]);

  useEffect(() => {
    if (!loading) return;
    loadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  const suggestionsByCategory = useMemo(() => getPromptSuggestionsByCategory(), []);
  const activeScenario = getGuidedScenario(activeScenarioId);

  function applyQuestion(text: string) {
    setQuestion(text);
    setError(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const marker = "想請教：";
      const idx = text.indexOf(marker);
      const pos = idx >= 0 ? idx + marker.length : text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function selectScenario(id: string) {
    if (activeScenarioId === id && slotFormOpen) {
      setActiveScenarioId(null);
      setSlotFormOpen(false);
      return;
    }
    setActiveScenarioId(id);
    setSlotFormOpen(true);
    setError(null);
  }

  function handleAssembledPrompt(prompt: string) {
    applyQuestion(prompt);
    setSlotFormOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 2) {
      setError("請輸入至少 2 個字");
      return;
    }
    setError(null);
    setNotice(null);
    setAnswer(null);
    setQuestionId(null);
    setSources(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ question: trimmed, stream: true }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "伺服器錯誤");
        return;
      }

      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";
        let meta: {
          model?: string;
          retrievalMode?: string;
          warning?: string;
        } = {};

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const block of chunks) {
            const line = block.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            let ev: Record<string, unknown>;
            try {
              ev = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              continue;
            }
            if (ev.type === "status" && ev.stage === "retrieve") {
              setNotice("正在檢索法規／函釋…");
            } else if (ev.type === "status" && ev.stage === "generate") {
              setNotice("正在整合分析作答…");
            } else if (ev.type === "delta" && typeof ev.text === "string") {
              acc += ev.text;
              setAnswer(acc);
              setLoading(false);
            } else if (ev.type === "error") {
              setError(typeof ev.error === "string" ? ev.error : "伺服器錯誤");
            } else if (ev.type === "done") {
              setQuestionId(typeof ev.questionId === "string" ? ev.questionId : null);
              setSources(Array.isArray(ev.sources) ? (ev.sources as CitationSource[]) : []);
              meta = {
                model: typeof ev.model === "string" ? ev.model : undefined,
                retrievalMode:
                  typeof ev.retrievalMode === "string" ? ev.retrievalMode : undefined,
                warning: typeof ev.warning === "string" ? ev.warning : undefined,
              };
            }
          }
        }

        if (meta.model === "off-topic" || meta.retrievalMode === "off-topic") {
          setNotice(null);
        } else if (meta.warning === "openai-unavailable" || meta.model === "keyword-fallback") {
          setNotice("目前以 RAG 檢索摘錄回覆（未使用 OpenAI 生成）。");
        } else if (typeof meta.retrievalMode === "string" && meta.retrievalMode.startsWith("rag-")) {
          setNotice(`已限定於法規／函釋資料庫檢索並整合分析作答（${meta.retrievalMode}）。`);
        } else if (acc) {
          setNotice(null);
        }
        return;
      }

      const data = await res.json().catch(() => ({}));
      setAnswer(data.answer ?? "");
      setQuestionId(typeof data.questionId === "string" ? data.questionId : null);
      setSources(Array.isArray(data.sources) ? data.sources : []);
      if (data.model === "off-topic" || data.retrievalMode === "off-topic") {
        setNotice(null);
      } else if (data.warning === "openai-unavailable" || data.model === "keyword-fallback") {
        setNotice("目前以 RAG 檢索摘錄回覆（未使用 OpenAI 生成）。");
      } else if (typeof data.retrievalMode === "string" && data.retrievalMode.startsWith("rag-")) {
        setNotice(`已限定於法規／函釋資料庫檢索並整合分析作答（${data.retrievalMode}）。`);
      }
    } catch {
      setError("無法連線，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <CitationSidebar source={sidebarSource} onClose={() => setSidebarSource(null)} />
    <section className="chat-panel-tech rounded-xl border border-[var(--border)] p-6 shadow-sm">
      <div className="chat-block-header rounded-lg p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">提問（限法規／函釋資料庫）</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              提問送出後，系統會限定於
              <Link href="/regulations" className="no-underline hover:underline">
                「法規／函釋」資料庫
              </Link>
              檢索全文（非摘要）並整合分析以找出正確解答。題庫僅供練習／模擬考試，不作為回答論據。與政府採購法規無關之問題將直接回覆「非本主題的範圍」。
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="chat-block-scenario rounded-lg p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-[var(--fg)]">① 選擇預設情境</p>
            {activeScenarioId ? (
              <button
                type="button"
                className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
                onClick={() => {
                  setActiveScenarioId(null);
                  setSlotFormOpen(false);
                }}
              >
                清除情境選擇
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{GUIDED_INTRO}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDED_SCENARIOS.map((s) => {
              const selected = activeScenarioId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={loading}
                  onClick={() => selectScenario(s.id)}
                  aria-pressed={selected}
                  className={
                    selected
                      ? "rounded-lg border border-sky-400 bg-sky-50 px-3 py-3 text-left transition disabled:opacity-60"
                      : "rounded-lg border border-[var(--border)] bg-white/90 px-3 py-3 text-left hover:border-sky-300 hover:bg-sky-50/60 disabled:opacity-60"
                  }
                >
                  <span className="block text-sm font-semibold text-[var(--fg)]">{s.title}</span>
                  <span className="mt-1 block text-xs leading-snug text-[var(--muted)]">
                    {s.description}
                  </span>
                </button>
              );
            })}
          </div>

          {activeScenario && slotFormOpen ? (
            <GuidedSlotForm
              scenario={activeScenario}
              disabled={loading}
              onCancel={() => setSlotFormOpen(false)}
              onAssemble={handleAssembledPrompt}
            />
          ) : null}

          {activeScenario && !slotFormOpen ? (
            <div className="mt-4 rounded-lg border border-sky-100 bg-white/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-sky-950">
                  目前情境：{activeScenario.title}
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setSlotFormOpen(true)}
                  className="rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-60"
                >
                  重新填寫欄位組裝
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                已組裝的問題可在下方編輯後送出；也可再次開啟表單調整標的／金額。
              </p>
            </div>
          ) : null}
        </div>

        <div className="chat-block-question rounded-lg p-4">
          <label className="block text-sm font-medium text-[var(--fg)]" htmlFor="q">
            ③ 您的問題
            {activeScenario ? (
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                （目前情境：{activeScenario.title}
                {slotFormOpen ? "｜請先完成欄位組裝" : ""}）
              </span>
            ) : null}
          </label>
          <textarea
            ref={textareaRef}
            id="q"
            name="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={7}
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white/95 p-3 text-sm outline-none ring-sky-200 backdrop-blur-sm focus:ring-2"
            placeholder="可先選上方情境，或直接輸入。例：未達公告金額採購，是否仍應公開閱覽招標文件？"
            required
            minLength={2}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="chat-submit-spinner" aria-hidden="true" />
                  處理中…
                </>
              ) : (
                "送出"
              )}
            </button>
            {question ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => setQuestion("")}
                className="text-xs text-[var(--muted)] underline-offset-2 hover:underline disabled:opacity-60"
              >
                清空內容
              </button>
            ) : null}
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{PROMPT_TIP}</p>
        </div>

        <div className="chat-block-suggestions rounded-lg p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setShowMoreExamples((v) => !v)}
            aria-expanded={showMoreExamples}
          >
            <span>
              <span className="block text-sm font-medium text-[var(--fg)]">更多常見問題範例</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                依題庫分類瀏覽；點選可帶入文字後再修改。
              </span>
            </span>
            <span className="text-xs text-[var(--muted)]">{showMoreExamples ? "收合" : "展開"}</span>
          </button>
          {showMoreExamples ? (
            <div className="mt-3 space-y-4">
              {suggestionsByCategory.map(({ category, items }) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-[var(--muted)]">{category}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        disabled={loading}
                        onClick={() => applyQuestion(item.question)}
                        className="max-w-full rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-left text-xs leading-snug text-[var(--fg)] hover:border-sky-300 hover:bg-sky-50 disabled:opacity-60"
                      >
                        {item.question}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </form>

      {loading ? (
        <div
          ref={loadingRef}
          className="chat-block-loading mt-6 rounded-lg p-5"
          role="status"
          aria-live="polite"
          aria-label="正在產生回答"
        >
          <div className="flex items-start gap-4">
            <div className="chat-loading-icon" aria-hidden="true">
              <span className="chat-loading-icon-doc" />
              <span className="chat-loading-icon-scan" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="chat-loading-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <p className="text-sm font-semibold text-amber-900">正在檢索法規／函釋並整合分析</p>
              </div>
              <p className="mt-2 text-xs text-amber-800/80">限定法規／函釋資料庫範圍比對中，請稍候…</p>
              <div className="chat-loading-bar mt-3" aria-hidden="true">
                <span className="chat-loading-bar-fill" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      ) : null}

      {answer ? (
        <div ref={answerRef} className="chat-block-answer mt-6 space-y-4 rounded-lg p-5">
          <h2 className="text-base font-semibold">回答</h2>
          {sources && sources.length > 0 ? (
            <CitationAnswer
              answer={answer}
              sources={sources}
              onOpenSidebar={setSidebarSource}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</div>
          )}
          {sources && sources.length > 0 ? (
            <CitationChips
              sources={sources}
              activeIndex={sidebarSource?.index ?? null}
              onOpen={setSidebarSource}
            />
          ) : null}
          {questionId ? <AnswerFeedback key={questionId} questionId={questionId} /> : null}
        </div>
      ) : null}
    </section>
    </>
  );
}
