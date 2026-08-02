import Link from "next/link";

import { RegisterPageClient } from "@/components/RegisterPageClient";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth-config";

/**
 * 靜態殼層：不在 server 讀 session／DB，以利公開註冊頁 TTFB < 0.5s。
 * 已登入提示與 ?error= 由客戶端處理。
 */
export default function RegisterPage() {
  const googleReady = isGoogleOAuthConfigured();

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

        <div className="mt-6">
          <RegisterPageClient googleReady={googleReady} />
        </div>
      </div>
    </section>
  );
}
