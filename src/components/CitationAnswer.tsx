"use client";

import { useId, useState } from "react";

import {
  splitAnswerWithCitations,
  type CitationSource,
} from "@/lib/citations";

type CitationAnswerProps = {
  answer: string;
  sources: CitationSource[];
  /** 若提供，inline [片段N] 點擊後直接開側邊欄（取代 popover） */
  onOpenSidebar?: (source: CitationSource) => void;
};

/** 回答正文：將 [片段N] 渲染為可點擊的 Citation Chip 標籤 */
export function CitationAnswer({ answer, sources, onOpenSidebar }: CitationAnswerProps) {
  const byIndex = new Map(sources.map((s) => [s.index, s]));
  const segments = splitAnswerWithCitations(answer);
  const baseId = useId();

  /* 若沒有傳入 onOpenSidebar，沿用 popover 模式 */
  const [popoverIndex, setPopoverIndex] = useState<number | null>(null);

  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return <span key={`${baseId}-t-${i}`}>{seg.text}</span>;
        }
        const src = byIndex.get(seg.index);
        if (!src) {
          return (
            <span key={`${baseId}-c-${i}`} className="text-[var(--muted)]">
              [片段{seg.index}]
            </span>
          );
        }

        const isActive = popoverIndex === seg.index;

        if (onOpenSidebar) {
          return (
            <button
              key={`${baseId}-c-${i}`}
              type="button"
              onClick={() => onOpenSidebar(src)}
              className="citation-inline-chip"
              title={`${src.title}${src.articleKey ? `｜${src.articleKey}` : ""}`}
            >
              片段{seg.index}
            </button>
          );
        }

        /* fallback：保留 popover */
        return (
          <span key={`${baseId}-c-${i}`} className="relative inline-block">
            <button
              type="button"
              onClick={() => setPopoverIndex(isActive ? null : seg.index)}
              className="mx-0.5 rounded border border-sky-300 bg-sky-50 px-1 py-0.5 text-[11px] font-medium text-sky-900 hover:bg-sky-100"
              aria-expanded={isActive}
            >
              片段{seg.index}
            </button>
            {isActive ? (
              <div
                role="dialog"
                aria-label={`引文片段 ${src.index}`}
                className="absolute left-0 top-full z-30 mt-1 w-[min(100vw-2rem,28rem)] rounded-lg border border-sky-200 bg-white p-3 text-left shadow-lg"
              >
                <p className="text-xs font-semibold text-sky-950">
                  【片段{src.index}】{src.title}
                  {src.articleKey ? `｜${src.articleKey}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  {src.tier}
                  {src.versionLabel ? `｜版本／異動：${src.versionLabel}` : ""}
                </p>
                <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[var(--fg)]">
                  {src.content}
                </div>
              </div>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
