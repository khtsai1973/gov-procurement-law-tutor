"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { getPromptSuggestionsByCategory, PROMPT_TIP } from "@/lib/prompt-suggestions";
import { SCENARIO_TEMPLATES } from "@/lib/scenario-templates";

type Source = { title: string; tier: string; slug: string };

export function ChatPanel({ signedIn }: { signedIn: boolean }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  function applyQuestion(text: string) {
    setQuestion(text);
    setError(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = text.includes("想請教：") ? text.length : text.length;
      el.setSelectionRange(pos, pos);
    });
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
    setSources(null);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "伺服器錯誤");
        return;
      }
      setAnswer(data.answer ?? "");
      setSources(Array.isArray(data.sources) ? data.sources : []);
      if (data.warning === "openai-unavailable" || data.model === "keyword-fallback") {
        setNotice("目前以 RAG 檢索摘錄回覆（未使用 OpenAI 生成）。");
      } else if (
        typeof data.retrievalMode === "string" &&
        data.retrievalMode.includes("question-bank")
      ) {
        setNotice("法規／函釋與題庫檢索後整合多則片段作答。");
      } else if (typeof data.retrievalMode === "string" && data.retrievalMode.startsWith("rag-")) {
        setNotice(`已自法規／函釋清單及題庫檢索全文並產生回答（${data.retrievalMode}）。`);
      }
    } catch {
      setError("無法連線，請稍後再試。");
    } finally {
      setLoading(false);
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
              及題庫 檢索整合分析全文（非摘要）以找出解答（仍須有檢索依據）。
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
                  處理中…
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
                <p className="text-sm font-semibold text-amber-900">正在檢索法規並產生回答</p>
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
        <div
          ref={answerRef}
          className="chat-block-answer mt-6 space-y-4 rounded-lg p-5"
        >
          <h2 className="text-base font-semibold">回答</h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</div>
          {sources && sources.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-[var(--muted)]">參考來源（摘錄所屬法規／函釋）</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {sources.map((s, i) => (
                  <li key={`${s.slug}-${i}`}>
                    {s.title}
                    <span className="text-[var(--muted)]">（{s.tier}）</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
