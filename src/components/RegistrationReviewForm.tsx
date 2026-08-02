"use client";

import { useState, useTransition } from "react";

import { reviewRegistrationApplication } from "@/app/actions/registration";

type RegistrationReviewFormProps = {
  id: string;
};

export function RegistrationReviewForm({ id }: RegistrationReviewFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(decision: "APPROVE" | "REJECT") {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("decision", decision);
    const noteEl = document.getElementById(`review-note-${id}`) as HTMLTextAreaElement | null;
    if (noteEl?.value) fd.set("reviewNote", noteEl.value);

    startTransition(async () => {
      setMessage(null);
      setError(null);
      const res = await reviewRegistrationApplication(fd);
      if (res.ok) setMessage(res.message);
      else setError(res.error);
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <label className="block text-xs font-medium text-[var(--muted)]" htmlFor={`review-note-${id}`}>
        審核備註（選填）
      </label>
      <textarea
        id={`review-note-${id}`}
        rows={2}
        className="w-full rounded-lg border border-[var(--border)] bg-white p-2 text-sm"
        placeholder="可寫給申請人的說明…"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("APPROVE")}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "處理中…" : "核准加入"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("REJECT")}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          拒絕
        </button>
      </div>
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
