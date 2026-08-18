"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { loginWithGoogle, logout } from "@/app/actions/auth";

type AuthNavControlsProps = {
  googleReady: boolean;
};

/** 登入狀態改由客戶端讀取，避免公開頁 server TTFB 被 session／DB 拖慢 */
export function AuthNavControls({ googleReady }: AuthNavControlsProps) {
  const { data: session, status } = useSession();

  const guestControls = (
    <span className="inline-flex min-h-[2.25rem] items-center gap-3">
      <Link href="/register" className="nav-link">
        申請註冊
      </Link>
      {googleReady ? (
        <form action={loginWithGoogle}>
          <button
            type="submit"
            className="nav-control rounded-md bg-[var(--accent)] px-3 py-1.5 text-white hover:opacity-90"
          >
            以 Google 登入
          </button>
        </form>
      ) : (
        <Link
          href="/auth/setup"
          className="nav-control rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 no-underline hover:bg-amber-100"
        >
          設定 Google 登入
        </Link>
      )}
    </span>
  );

  if (status !== "authenticated" || !session?.user) {
    return guestControls;
  }

  return (
    <>
      <Link href="/dashboard" className="nav-link">
        學習儀表板
      </Link>
      <Link href="/my-questions" className="nav-link">
        我的提問紀錄
      </Link>
      {session.user.role === "TEACHER" || session.user.role === "ADMIN" ? (
        <Link href="/teacher" className="nav-link">
          老師
        </Link>
      ) : null}
      {session.user.role === "ADMIN" ? (
        <Link href="/admin" className="nav-link">
          管理者
        </Link>
      ) : null}
      <span className="text-[var(--muted)]">
        {session.user.nickname ?? session.user.email}
      </span>
      <form action={logout}>
        <button
          type="submit"
          className="nav-control rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[var(--fg)] hover:bg-gray-50"
        >
          登出
        </button>
      </form>
    </>
  );
}
