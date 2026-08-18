import Link from "next/link";

import { AuthNavControls } from "@/components/AuthNavControls";
import { Logo } from "@/components/Logo";
import { MaterialsNavLink } from "@/components/MaterialsNavLink";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth-config";

/** 公開導覽不 await session，降低首頁／註冊頁 TTFB */
export function Nav() {
  const googleReady = isGoogleOAuthConfigured();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
      <div>
        <Link href="/" className="group inline-flex items-center gap-3 no-underline">
          <Logo size={44} showWordmark />
        </Link>
        <p className="mt-2 text-sm text-[var(--muted)]">
          回答來源限於已匯入之法規／函釋資料庫（檢索並整合分析）
        </p>
      </div>
      <nav className="flex min-h-[2.25rem] flex-wrap items-center gap-3 text-sm">
        <Link href="/regulations" className="nav-link">
          法規／函釋／題庫清單
        </Link>
        <Link href="/question-bank" className="nav-link">
          題庫
        </Link>
        <MaterialsNavLink />
        <Link href="/mock-exam" className="nav-link">
          模擬考試
        </Link>
        <Link href="/scenario-essay" className="nav-link">
          情境申論
        </Link>
        <AuthNavControls googleReady={googleReady} />
        <Link href="/privacy" className="nav-link">
          隱私權
        </Link>
      </nav>
    </header>
  );
}
