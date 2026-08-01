"use client";

import { useState, useTransition } from "react";

import { replyTeacherGuidance } from "@/app/actions/teacher-guidance";

type TeacherGuidanceReplyFormProps = {
  id: string;
  initialGuidance: string;
  replied: boolean;
};

export function TeacherGuidanceReplyForm({
  id,
  initialGuidance,
  replied,
}: TeacherGuidanceReplyFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-2"
      action={(fd) => {
        startTransition(async () => {
          setMessage(null);
          const res = await replyTeacherGuidance(fd);
          setMessage(res.ok ? "已儲存老師指導內容" : res.error);
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <label className="block text-sm font-medium" htmlFor={`guidance-${id}`}>
        老師指導內容
      </label>
      <textarea
        id={`guidance-${id}`}
        name="teacherGuidance"
        defaultValue={initialGuidance}
        rows={4}
        className="w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm"
        placeholder="請針對此題寫下指導說明…"
        required
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "儲存中…" : replied ? "更新回覆" : "送出指導"}
        </button>
        {message ? <span className="text-sm text-[var(--muted)]">{message}</span> : null}
      </div>
    </form>
  );
}
