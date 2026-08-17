import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import Link from "next/link";

import "./globals.css";
import { Nav } from "@/components/Nav";
import { SessionProvider } from "@/components/SessionProvider";

const noto = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  weight: ["400", "700"],
  display: "swap",
  adjustFontFallback: true,
  preload: true,
});

// 不在 root layout 強制 dynamic，讓公開頁可靜態／快取；需即時資料的頁面各自宣告 force-dynamic

export const metadata: Metadata = {
  title: "政府採購法互動教學",
  description: "以登入使用者為單位記錄提問，並僅於指定法規／函釋知識庫內作答。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={noto.variable}>
      <body className="min-h-screen font-sans antialiased">
        <SessionProvider>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-10 pt-6">
            <Nav />
            <main className="mt-6 flex-1">{children}</main>
            <footer className="mt-10 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link href="/privacy" className="no-underline hover:underline">
                  隱私權政策
                </Link>
                <Link href="/register" className="no-underline hover:underline">
                  申請註冊
                </Link>
                <span>政府採購法互動教學</span>
              </div>
            </footer>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
