"use client";

import { useEffect, useRef } from "react";

import "./citation-sidebar.css";

import type { CitationSource } from "@/lib/citations";

type CitationSidebarProps = {
  source: CitationSource | null;
  onClose: () => void;
};

/** 右側抽屜：顯示完整引文原文、法條對照與官方來源連結 */
export function CitationSidebar({ source, onClose }: CitationSidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = source !== null;

  /* Escape 關閉 */
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  /* body 捲動鎖定 */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  /* 開啟時 focus 面板，方便鍵盤操作 */
  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
    }
  }, [isOpen, source?.index]);

  return (
    <>
      {/* 遮罩 */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`citation-sidebar-backdrop ${isOpen ? "citation-sidebar-backdrop--open" : ""}`}
      />

      {/* 抽屜本體 */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={source ? `引文 片段${source.index}：${source.title}` : "引文側邊欄"}
        aria-modal="true"
        className={`citation-sidebar ${isOpen ? "citation-sidebar--open" : ""}`}
      >
        {source ? (
          <>
            {/* 標頭 */}
            <div className="citation-sidebar-header">
              <div className="min-w-0 flex-1">
                <span className="citation-sidebar-chip">片段 {source.index}</span>
                <h2 className="citation-sidebar-title">{source.title}</h2>
                {source.articleKey ? (
                  <p className="citation-sidebar-subtitle">{source.articleKey}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉側邊欄"
                className="citation-sidebar-close"
              >
                ✕
              </button>
            </div>

            {/* meta 列 */}
            <div className="citation-sidebar-meta">
              <span className="citation-sidebar-tier">{source.tier}</span>
              {source.versionLabel ? (
                <span className="citation-sidebar-version">版本 / 異動：{source.versionLabel}</span>
              ) : null}
            </div>

            {/* 原文區 */}
            <div className="citation-sidebar-body">
              <h3 className="citation-sidebar-section-label">引文原文</h3>
              <div className="citation-sidebar-content">{source.content}</div>
            </div>

            {/* 連結區 */}
            <div className="citation-sidebar-footer">
              {source.sourceUrl ? (
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="citation-sidebar-link citation-sidebar-link--primary"
                >
                  開啟工程會官方來源 ↗
                </a>
              ) : null}
              <a
                href={`/regulations#${source.slug}`}
                className="citation-sidebar-link citation-sidebar-link--secondary"
              >
                本站法規清單 →
              </a>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
