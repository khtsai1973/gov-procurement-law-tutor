"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";

import { CitationModal } from "@/components/CitationModal";
import type { ChatCitation } from "@/lib/chat-types";

const CITATION_RE = /\[片段\s*(\d+)\s*\]/g;

type AnswerWithCitationsProps = {
  answer: string;
  citations: ChatCitation[];
  streaming?: boolean;
};

function citationLabel(c: ChatCitation | undefined, index: number): string {
  if (!c) return `片段${index}`;
  if (c.articleLabel) return c.articleLabel;
  const short = c.title.length > 16 ? `${c.title.slice(0, 16)}…` : c.title;
  return short || `片段${index}`;
}

export function AnswerWithCitations({
  answer,
  citations,
  streaming = false,
}: AnswerWithCitationsProps) {
  const [active, setActive] = useState<ChatCitation | null>(null);
  const byIndex = useMemo(() => {
    const map = new Map<number, ChatCitation>();
    for (const c of citations) {
      if (c.index > 0) map.set(c.index, c);
    }
    return map;
  }, [citations]);

  const nodes = useMemo(() => {
    const parts: ReactNode[] = [];
    let last = 0;
    const re = new RegExp(CITATION_RE.source, "g");
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(answer)) !== null) {
      const start = match.index;
      if (start > last) {
        parts.push(<Fragment key={`t-${key++}`}>{answer.slice(last, start)}</Fragment>);
      }
      const index = Number.parseInt(match[1]!, 10);
      const citation = byIndex.get(index);
      parts.push(
        <button
          key={`c-${key++}`}
          type="button"
          onClick={() => {
            if (citation) setActive(citation);
          }}
          disabled={!citation}
          title={citation ? `${citation.title}${citation.articleLabel ? `｜${citation.articleLabel}` : ""}` : `片段 ${index}`}
          className="citation-tag mx-0.5 inline-flex translate-y-[-1px] items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium leading-none text-blue-800 hover:border-blue-400 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {citationLabel(citation, index)}
        </button>,
      );
      last = start + match[0].length;
    }
    if (last < answer.length) {
      parts.push(<Fragment key={`t-${key++}`}>{answer.slice(last)}</Fragment>);
    }
    return parts;
  }, [answer, byIndex]);

  const usedIndexes = useMemo(() => {
    const set = new Set<number>();
    const re = new RegExp(CITATION_RE.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(answer)) !== null) {
      set.add(Number.parseInt(match[1]!, 10));
    }
    return set;
  }, [answer]);

  return (
    <div className="space-y-4">
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {nodes}
        {streaming ? (
          <span className="citation-caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-[var(--accent)] align-middle" />
        ) : null}
      </div>

      {citations.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)]">參考來源（點擊可看原始切片）</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {citations.map((c) => (
              <li key={`${c.chunkId}-${c.index}`}>
                <button
                  type="button"
                  onClick={() => setActive(c)}
                  className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition ${
                    usedIndexes.has(c.index)
                      ? "border-blue-300 bg-blue-50 text-blue-900"
                      : "border-[var(--border)] bg-white text-[var(--fg)] hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <span className="font-medium">[{c.index}]</span> {c.title}
                  {c.articleLabel ? (
                    <span className="text-[var(--muted)]">｜{c.articleLabel}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <CitationModal citation={active} onClose={() => setActive(null)} />
    </div>
  );
}
