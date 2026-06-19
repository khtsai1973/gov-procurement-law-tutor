"use client";

import { useState, useTransition } from "react";

import { runKnowledgeIngest } from "@/app/actions/admin";

export function IngestForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setMessage(null);
            const res = await runKnowledgeIngest();
            if (res.ok) {
              setMessage(`完成：regulations=${res.regulationCount}, chunks=${res.chunkTotal}`);
            } else {
              setMessage(`失敗：${res.error}`);
            }
          });
        }}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "更新中…" : "載入／更新知識庫"}
      </button>
      {message ? <span className="text-sm text-[var(--muted)]">{message}</span> : null}
    </div>
  );
}
