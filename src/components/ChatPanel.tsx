"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AnswerFeedback } from "@/components/AnswerFeedback";
import { AnswerWithCitations } from "@/components/AnswerWithCitations";
import type { ChatCitation } from "@/lib/chat-types";
import { getPromptSuggestionsByCategory, PROMPT_TIP } from "@/lib/prompt-suggestions";
import { SCENARIO_TEMPLATES } from "@/lib/scenario-templates";
import { consumeSseBuffer } from "@/lib/sse";

export function ChatPanel({ signedIn }: { signedIn: boolean }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [sources, setSources] = useState<ChatCitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!answer) return;
    answerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [answer]);

  useEffect(() => {
    if (!loading || answer) return;
    loadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, answer]);

  const suggestionsByCategory = useMemo(() => getPromptSuggestionsByCategory(), []);

  function applyQuestion(text: string) {
    setQuestion(text);
    setError(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  }

  function applyNotice(model?: string, warning?: string, retrievalMode?: string) {
    if (model === "off-topic" || retrievalMode === "off-topic") {
      setNotice(null);
      return;
    }
    if (warning === "openai-unavailable" || model === "keyword-fallback") {
      setNotice("目前以 RAG 檢索摘錄回覆（未使用 OpenAI 生成）。");
      return;
    }
    if (typeof retrievalMode === "string" && retrievalMode.includes("question-bank")) {
      setNotice("法規／函釋與題庫檢索後整合多則片段作答。");
      return;
    }
    if (typeof retrievalMode === "string" && retrievalMode.startsWith("rag-")) {
      setNotice(`已自法規／函釋清單及題庫檢索全文並產生回答（${retrievalMode}）。`);
    }
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
    setSources([]);
    setLoading(true);
    setStreaming(false);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ question: trimmed }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "伺服器錯誤");
        return;
      }

      if (!contentType.includes("text/event-stream") || !res.body) {
        setError("伺服器未以串流回應，請重新整理後再試。");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";
      let hadStreamError = false;
      let retrievalMode: string | undefined;
      let model: string | undefined;
      let warning: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = consumeSseBuffer(buffer);
        buffer = rest;

        for (const ev of events) {
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(ev.data) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (ev.event === "meta") {
            if (typeof payload.questionId === "string") {
              setQuestionId(payload.questionId);
            }
            if (Array.isArray(payload.sources)) {
              setSources(payload.sources as ChatCitation[]);
            }
            if (typeof payload.retrievalMode === "string") {
              retrievalMode = payload.retrievalMode;
            }
            if (typeof payload.model === "string") {
              model = payload.model;
            }
            if (typeof payload.warning === "string") {
              warning = payload.warning;
            }
          } else if (ev.event === "token") {
            const text = typeof payload.text === "string" ? payload.text : "";
            if (text) {
              assembled += text;
              setStreaming(true);
              setAnswer(assembled);
            }
          } else if (ev.event === "done") {
            if (typeof payload.answer === "string") {
              assembled = payload.answer;
              setAnswer(assembled);
            }
            if (typeof payload.model === "string") model = payload.model;
            if (typeof payload.warning === "string") warning = payload.warning;
            if (typeof payload.retrievalMode === "string") {
              retrievalMode = payload.retrievalMode;
            }
            applyNotice(model, warning, retrievalMode);
          } else if (ev.event === "error") {
            hadStreamError = true;
            setError(
              typeof payload.error === "string" ? payload.error : "處理問題時發生錯誤",
            );
          }
        }
      }

      if (!assembled && !hadStreamError) {
        setError("未收到回答內容，請稍後再試。");
      }
    } catch {
      setError("無法連線，請稍後再試。");
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  if (!signedIn) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">開始學習</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          請先使用 Google 帳號登入；登入後本站會保存您的提問紀錄，並僅在已匯入之法規／函釋摘錄範圍內產生回答。
        </p>
      </section>
    );
  }

  return (
    <section className="chat-panel-tech rounded-xl border border-[var(--border)] p-6 shadow-sm">
      <div className="chat-block-header rounded-lg p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">提問（限知識庫範圍）</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              提問送出後，系統會自
              <Link href="/regulations" className="no-underline hover:underline">
                「法規／函釋／題庫清單」
              </Link>
              及題庫檢索整合分析全文（非摘要）以找出解答；回答會以串流顯示，並附可點擊的條文引用標籤。與政府採購法規無關之問題將直接回覆「非本主題的範圍」。
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="chat-block-scenario rounded-lg p-4">
          <p className="text-sm font-medium text-[var(--fg)]">情境模板</p>
          <p className="mt-1 text-xs text-[var(--muted)]">點選後帶入填空式提問，請在括號內補充您的案情。</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCENARIO_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={loading}
                onClick={() => applyQuestion(t.body)}
                className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--fg)] hover:border-blue-300 hover:bg-blue-50 disabled:opacity-60"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="chat-block-question rounded-lg p-4">
          <label className="block text-sm font-medium text-[var(--fg)]" htmlFor="q">
            您的問題
          </label>
          <textarea
            ref={textareaRef}
            id="q"
            name="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={6}
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white/95 p-3 text-sm outline-none ring-blue-200 backdrop-blur-sm focus:ring-2"
            placeholder="例：未達公告金額採購，是否仍應公開閱覽招標文件？"
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
                  {streaming ? "回答產生中…" : "處理中…"}
                </>
              ) : (
                "送出"
              )}
            </button>
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{PROMPT_TIP}</p>
        </div>

        <div className="chat-block-suggestions rounded-lg p-4">
          <p className="text-sm font-medium text-[var(--fg)]">常見問題範例</p>
          <p className="mt-1 text-xs text-[var(--muted)]">點選可帶入問題文字，再依需要修改後送出。</p>
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
                      className="max-w-full rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-left text-xs leading-snug text-[var(--fg)] hover:border-blue-300 hover:bg-blue-50 disabled:opacity-60"
                    >
                      {item.question}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>

      {loading && !answer ? (
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
                <p className="text-sm font-semibold text-amber-900">正在檢索法規並串流產生回答</p>
              </div>
              <p className="mt-2 text-xs text-amber-800/80">比對法規／函釋與題庫中，請稍候…</p>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">回答</h2>
            {streaming ? (
              <span className="text-xs font-medium text-amber-800" aria-live="polite">
                串流輸出中…
              </span>
            ) : null}
          </div>
          <AnswerWithCitations answer={answer} citations={sources} streaming={streaming} />
          {questionId && !streaming ? (
            <AnswerFeedback key={questionId} questionId={questionId} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
