import Link from "next/link";

import { loginWithGoogle, logout } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth-config";
import { getSession } from "@/lib/get-session";

export async function Nav() {
  const session = await getSession();
  const googleReady = isGoogleOAuthConfigured();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
      <div>
        <Link href="/" className="group inline-flex items-center gap-3 no-underline">
          <Logo size={44} showWordmark />
        </Link>
        <p className="mt-2 text-sm text-[var(--muted)]">回答來源限於已匯入之法規與函釋與題庫知識庫</p>
      </div>
      <nav className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/regulations" className="no-underline hover:underline">
          法規／函釋清單
        </Link>
        {session?.user ? (
          <>
            <Link href="/my-questions" className="no-underline hover:underline">
              我的提問紀錄
            </Link>
            {session.user.role === "ADMIN" ? (
              <Link href="/admin" className="no-underline hover:underline">
                管理者
              </Link>
            ) : null}
            <span className="text-[var(--muted)]">{session.user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[var(--fg)] hover:bg-gray-50"
              >
                登出
              </button>
            </form>
          </>
        ) : googleReady ? (
          <form action={loginWithGoogle}>
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-white hover:opacity-90"
            >
              以 Google 登入
            </button>
          </form>
        ) : (
          <Link
            href="/auth/setup"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 no-underline hover:bg-amber-100"
          >
            設定 Google 登入
          </Link>
        )}
      </nav>
    </header>
  );
}
