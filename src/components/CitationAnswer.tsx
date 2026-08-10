"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  splitAnswerWithCitations,
  type CitationSource,
} from "@/lib/citations";

function CitationPopover({
  source,
  open,
  onClose,
}: {
  source: CitationSource;
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`引文片段 ${source.index}`}
      className="absolute left-0 top-full z-30 mt-1 w-[min(100vw-2rem,28rem)] rounded-lg border border-sky-200 bg-white p-3 text-left shadow-lg"
    >
      <p className="text-xs font-semibold text-sky-950">
        【片段{source.index}】{source.title}
        {source.articleKey ? `｜${source.articleKey}` : ""}
      </p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        {source.tier}
        {source.versionLabel ? `｜版本／異動：${source.versionLabel}` : ""}
      </p>
      <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-[var(--fg)]">
        {source.content}
      </div>
      {source.sourceUrl ? (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[11px] text-sky-800 no-underline hover:underline"
        >
          開啟官方來源 →
        </a>
      ) : (
        <a
          href={`/regulations#${source.slug}`}
          className="mt-2 inline-block text-[11px] text-sky-800 no-underline hover:underline"
        >
          本站法規清單 →
        </a>
      )}
    </div>
  );
}

/** 回答正文：將 [片段N] 渲染為可點擊引文標籤＋原文 Popover */
export function CitationAnswer({
  answer,
  sources,
}: {
  answer: string;
  sources: CitationSource[];
}) {
  const byIndex = new Map(sources.map((s) => [s.index, s]));
  const segments = splitAnswerWithCitations(answer);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();

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
        const isOpen = openIndex === seg.index;
        return (
          <span key={`${baseId}-c-${i}`} className="relative inline-block">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : seg.index)}
              className="mx-0.5 rounded border border-sky-300 bg-sky-50 px-1 py-0.5 text-[11px] font-medium text-sky-900 hover:bg-sky-100"
              aria-expanded={isOpen}
            >
              片段{seg.index}
            </button>
            <CitationPopover
              source={src}
              open={isOpen}
              onClose={() => setOpenIndex(null)}
            />
          </span>
        );
      })}
    </div>
  );
}
