"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h1 className="text-xl font-semibold">頁面暫時無法載入</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        伺服器處理此頁時發生錯誤。常見原因是資料庫欄位尚未自動補齊，請稍後再試；若持續發生，請重新整理或回到首頁。
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Digest：<code className="rounded bg-slate-100 px-1">{error.digest}</code>
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          再試一次
        </button>
        <Link href="/" className="rounded-md border border-[var(--border)] px-4 py-2 text-sm no-underline hover:bg-slate-50">
          回到首頁
        </Link>
      </div>
    </section>
  );
}
