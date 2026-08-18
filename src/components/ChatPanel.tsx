"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSession } from "next-auth/react";

const AuthenticatedChatPanel = dynamic(
  () =>
    import("@/components/AuthenticatedChatPanel").then((m) => m.AuthenticatedChatPanel),
  {
    loading: () => (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">提問（限法規／函釋資料庫）</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">載入對話中…</p>
      </section>
    ),
  },
);

function GuestHomeChat() {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h1 className="text-xl font-semibold">開始學習</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        請先
        <Link href="/register" className="mx-1 underline">
          申請註冊
        </Link>
        並經管理者核准後，再以 Google 帳號登入。登入後本站會保存您的提問紀錄，並僅在已匯入之法規／函釋摘錄範圍內產生回答。詳見
        <Link href="/privacy" className="mx-1 underline">
          隱私權政策
        </Link>
        。
      </p>
    </section>
  );
}

/** 訪客立即顯示 h1（不等 session）；登入後才載入情境組裝／引文／回饋 */
export function ChatPanel() {
  const { status } = useSession();
  if (status === "authenticated") {
    return <AuthenticatedChatPanel />;
  }
  return <GuestHomeChat />;
}
