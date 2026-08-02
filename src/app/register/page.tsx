import Link from "next/link";

import { loginWithGoogle } from "@/app/actions/auth";
import { RegistrationForm } from "@/components/RegistrationForm";
import { getSession } from "@/lib/get-session";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth-config";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const { error } = await searchParams;
  const googleReady = isGoogleOAuthConfigured();

  if (session?.user?.id) {
    return (
      <section className="mx-auto max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">註冊申請</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">您已登入，無需再申請註冊。</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          返回首頁
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">申請加入</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              訪客可申請「一般使用者」或「老師」角色。管理者核准後，請以申請時填寫的同一 Google
              帳號登入即可加入。
            </p>
          </div>
          <Link href="/" className="text-sm no-underline hover:underline">
            ← 首頁
          </Link>
        </div>

        {error === "not-approved" ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            此 Google 帳號尚未核准加入。請先完成本頁申請，或等候管理者審核後再登入。
          </p>
        ) : null}

        <div className="mt-6">
          <RegistrationForm />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">已核准？</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          若管理者已核准您的申請，請以相同信箱的 Google 帳號登入。
        </p>
        {googleReady ? (
          <form action={loginWithGoogle} className="mt-4">
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              以 Google 登入
            </button>
          </form>
        ) : (
          <Link href="/auth/setup" className="mt-4 inline-block text-sm underline">
            設定 Google 登入
          </Link>
        )}
      </div>
    </section>
  );
}
