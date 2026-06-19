import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";

import "./globals.css";
import { Nav } from "@/components/Nav";
import { SessionProvider } from "@/components/SessionProvider";

const noto = Noto_Sans_TC({ subsets: ["latin"], variable: "--font-noto-sans", weight: ["400", "500", "700"] });

export const dynamic = "force-dynamic";

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
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
