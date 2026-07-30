"use client";

import { useState, useTransition } from "react";

import { runKnowledgeIngest, runQuestionBankReplace } from "@/app/actions/admin";

export function IngestForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              setMessage(null);
              const res = await runKnowledgeIngest();
              if (res.ok) {
                setMessage(`知識庫完成：regulations=${res.regulationCount}, chunks=${res.chunkTotal}`);
              } else {
                setMessage(`知識庫失敗：${res.error}`);
              }
            });
          }}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "處理中…" : "載入／更新知識庫"}
        </button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-950">題庫：清空後重新匯入</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
          會刪除資料庫全部題庫列，再寫入目前部署內的{" "}
          <code className="rounded bg-white/80 px-1">data/question-bank/*.json</code>
          （正式 14 類）。模擬考試作答紀錄不會刪除。
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "確定清空正式題庫並重新匯入？此操作不可復原（僅影響題庫題目，不刪除學員測驗紀錄）。",
              )
            ) {
              return;
            }
            startTransition(async () => {
              setMessage(null);
              const res = await runQuestionBankReplace();
              if (res.ok) {
                setMessage(
                  `題庫重匯完成：刪除 ${res.deleted}（先前約 ${res.before}）、匯入 ${res.imported} 題` +
                    (res.categories != null ? `、${res.categories} 類` : ""),
                );
              } else {
                setMessage(`題庫重匯失敗：${res.error}`);
              }
            });
          }}
          className="mt-3 rounded-md border border-amber-700 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "處理中…" : "清空並重新匯入題庫"}
        </button>
      </div>

      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
