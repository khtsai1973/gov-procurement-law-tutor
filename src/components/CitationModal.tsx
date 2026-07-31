"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import type { ChatCitation } from "@/lib/chat-types";

type CitationModalProps = {
  citation: ChatCitation | null;
  onClose: () => void;
};

export function CitationModal({ citation, onClose }: CitationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (citation) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [citation]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="citation-modal w-[min(40rem,calc(100vw-2rem))] max-h-[min(80vh,40rem)] rounded-xl border border-[var(--border)] bg-white p-0 shadow-xl backdrop:bg-black/40"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      {citation ? (
        <div className="flex max-h-[min(80vh,40rem)] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--muted)]">片段 {citation.index}</p>
              <h2 className="mt-1 text-base font-semibold leading-snug">
                {citation.title}
                {citation.articleLabel ? (
                  <span className="ml-1 font-normal text-[var(--muted)]">
                    ｜{citation.articleLabel}
                  </span>
                ) : null}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {citation.tier}
                {citation.slug ? ` · ${citation.slug}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md border border-[var(--border)] px-2.5 py-1 text-sm hover:bg-gray-50"
              aria-label="關閉"
            >
              關閉
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">
              資料庫比對出的原始法規／函釋切片
            </p>
            {citation.content ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--fg)]">
                {citation.content}
              </pre>
            ) : (
              <p className="text-sm text-[var(--muted)]">此筆引用未附原始切片內容。</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-5 py-3 text-sm">
            <Link
              href={`/regulations#${citation.slug}`}
              className="no-underline hover:underline"
              onClick={onClose}
            >
              在法規清單查看
            </Link>
            {citation.sourceUrl ? (
              <a
                href={citation.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="no-underline hover:underline"
              >
                原始來源連結
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
