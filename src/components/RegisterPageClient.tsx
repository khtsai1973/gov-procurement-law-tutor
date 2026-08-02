"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { loginWithGoogle } from "@/app/actions/auth";
import { RegistrationForm } from "@/components/RegistrationForm";

function RegisterBody({ googleReady }: { googleReady: boolean }) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (status === "loading") {
    return <p className="text-sm text-[var(--muted)]">載入中…</p>;
  }

  if (session?.user?.id) {
    return (
      <div>
        <p className="text-sm text-[var(--muted)]">您已登入，無需再申請註冊。</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          返回首頁
        </Link>
      </div>
    );
  }

  return (
    <>
      {error === "not-approved" ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          此 Google 帳號尚未核准加入。請先完成本頁申請，或等候管理者審核後再登入。
        </p>
      ) : null}

      <RegistrationForm />

      <div className="mt-8 border-t border-[var(--border)] pt-6">
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
    </>
  );
}

export function RegisterPageClient({ googleReady }: { googleReady: boolean }) {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">載入中…</p>}>
      <RegisterBody googleReady={googleReady} />
    </Suspense>
  );
}
