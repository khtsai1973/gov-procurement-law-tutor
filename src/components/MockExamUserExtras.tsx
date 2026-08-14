"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { MockExamAnalyticsCharts } from "@/components/MockExamAnalyticsCharts";
import { MockExamHistory } from "@/components/MockExamHistory";
import type { MockExamAnalyticsData, MockExamHistoryRow } from "@/lib/mock-exam";

type BootstrapPayload = {
  nickname: string | null;
  history: MockExamHistoryRow[];
  analytics: MockExamAnalyticsData;
};

type MockExamUserExtrasProps = {
  onNicknameLoaded?: (nickname: string | null) => void;
};

/** 登入後由客戶端載入模考紀錄／分析，避免 SSR 等 session 拉高 TTFB */
export function MockExamUserExtras({ onNicknameLoaded }: MockExamUserExtrasProps) {
  const { status } = useSession();
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/mock-exam/bootstrap", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) return;
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as BootstrapPayload;
        if (cancelled) return;
        setData(json);
        onNicknameLoaded?.(json.nickname);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "載入失敗");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, onNicknameLoaded]);

  if (status === "loading" || (status === "authenticated" && !data && !error)) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)] shadow-sm">
          載入測驗紀錄與分析中…
        </div>
      </div>
    );
  }

  if (status !== "authenticated") return null;

  if (error) {
    return (
      <p className="mt-6 text-sm text-red-600">無法載入測驗紀錄：{error}</p>
    );
  }

  if (!data) return null;

  return (
    <div className="mt-6 space-y-6">
      <MockExamHistory records={data.history} />
      <MockExamAnalyticsCharts data={data.analytics} />
    </div>
  );
}
