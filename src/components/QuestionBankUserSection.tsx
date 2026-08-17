"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";

import { QuestionBankWeaknessPanel } from "@/components/QuestionBankWeaknessPanel";
import type { UserQuestionBankWeakness } from "@/lib/question-bank-weakness";
import { canAccessTeacher } from "@/lib/roles";

/** 題庫頁登入態 UI：弱點儀表板、管理連結（不在 SSR 讀 session） */
export function QuestionBankUserSection() {
  const { data: session, status } = useSession();
  const [weakness, setWeakness] = useState<UserQuestionBankWeakness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      setWeakness(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch("/api/question-bank/weakness", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) return;
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as { weakness: UserQuestionBankWeakness };
        if (!cancelled) setWeakness(json.weakness);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "載入失敗");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  if (status !== "authenticated" || !session?.user) {
    return (
      <div className="min-h-[4.5rem] rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
        登入後可依模擬考試紀錄顯示弱點分析，並對題庫單題使用 AI 錯題原因分析。
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[4.5rem] rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--muted)]">
        載入弱點分析中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        弱點分析載入失敗：{error}
      </div>
    );
  }

  if (!weakness) return null;

  return <QuestionBankWeaknessPanel weakness={weakness} />;
}

export function QuestionBankTeacherLink() {
  const { data: session, status } = useSession();
  if (status !== "authenticated" || !canAccessTeacher(session?.user?.role)) {
    return null;
  }
  return (
    <Link href="/teacher/question-bank" className="no-underline hover:underline">
      管理題庫
    </Link>
  );
}

/** 僅登入使用者可見的子元件 */
export function QuestionBankSignedInOnly({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status !== "authenticated") return null;
  return <>{children}</>;
}
