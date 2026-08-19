"use client";

import "./citation-sidebar.css";
import type { CitationSource } from "@/lib/citations";

type CitationChipsProps = {
  sources: CitationSource[];
  activeIndex: number | null;
  onOpen: (source: CitationSource) => void;
};

/**
 * 回答底部：可捲動的 Citation Chip 卡片列。
 * 每張卡片顯示 法規名稱 + 條文 + 類型，點擊開啟側邊欄。
 */
export function CitationChips({ sources, activeIndex, onOpen }: CitationChipsProps) {
  if (sources.length === 0) return null;

  return (
    <div className="citation-chips-bar" aria-label="引文來源卡片">
      <p className="citation-chips-label">引用來源（點擊查看原文）</p>
      <div className="citation-chips-scroll">
        {sources.map((s) => {
          const active = activeIndex === s.index;
          return (
            <button
              key={`${s.chunkId}-${s.index}`}
              type="button"
              onClick={() => onOpen(s)}
              aria-pressed={active}
              className={`citation-chip ${active ? "citation-chip--active" : ""}`}
            >
              <span className="citation-chip-index">片段 {s.index}</span>
              <span className="citation-chip-title">{s.title}</span>
              {s.articleKey ? (
                <span className="citation-chip-article">{s.articleKey}</span>
              ) : null}
              <span className="citation-chip-tier">{s.tier}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
