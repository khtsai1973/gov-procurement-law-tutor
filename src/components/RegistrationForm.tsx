"use client";

import { useState, useTransition } from "react";

import { submitRegistrationApplication } from "@/app/actions/registration";

export function RegistrationForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(fd) => {
        startTransition(async () => {
          setMessage(null);
          setError(null);
          const res = await submitRegistrationApplication(fd);
          if (res.ok) setMessage(res.message);
          else setError(res.error);
        });
      }}
    >
      <div>
        <label className="block text-sm font-medium" htmlFor="email">
          電子郵件（須與之後 Google 登入相同）
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="name">
          姓名／暱稱（選填）
        </label>
        <input
          id="name"
          name="name"
          type="text"
          maxLength={80}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
          placeholder="顯示用名稱"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">申請角色</legend>
        <div className="mt-2 space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="requestedRole"
              value="USER"
              defaultChecked
              className="mt-1"
              required
            />
            <span>
              <span className="font-medium">一般使用者</span>
              <span className="block text-xs text-[var(--muted)]">
                可提問、模擬考試、閱讀已發布教材
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="requestedRole" value="TEACHER" className="mt-1" />
            <span>
              <span className="font-medium">老師</span>
              <span className="block text-xs text-[var(--muted)]">
                可製作教材、管理題庫、檢視學員學習與回覆指導
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium" htmlFor="note">
          申請說明（選填）
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
          placeholder="例：服務單位、授課需求…"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {pending ? "送出中…" : "送出註冊申請"}
      </button>

      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </form>
  );
}
