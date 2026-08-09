"use client";

import { useState, useTransition } from "react";

import { updateUserRole } from "@/app/actions/admin";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/roles";

type UserRoleFormProps = {
  userId: string;
  currentRole: string;
  disabled?: boolean;
};

export function UserRoleForm({ userId, currentRole, disabled }: UserRoleFormProps) {
  const [role, setRole] = useState(currentRole);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("role", role);
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const res = await updateUserRole(fd);
      if (res.ok) setMessage(res.message);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <label className="sr-only" htmlFor={`role-${userId}`}>
        角色
      </label>
      <select
        id={`role-${userId}`}
        value={role}
        disabled={disabled || pending}
        onChange={(e) => {
          setRole(e.target.value);
          setMessage(null);
          setError(null);
        }}
        className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm disabled:opacity-60"
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled || pending || role === currentRole}
        onClick={submit}
        className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "儲存中…" : "更新角色"}
      </button>
      {message ? <p className="text-sm text-emerald-800 sm:basis-full">{message}</p> : null}
      {error ? <p className="text-sm text-red-700 sm:basis-full">{error}</p> : null}
    </div>
  );
}
