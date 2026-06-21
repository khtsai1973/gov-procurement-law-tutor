import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MockExamSingleSessionCharts } from "@/components/MockExamSingleSessionCharts";
import {
  formatAnswerLabel,
  formatDuration,
  mockExamTypeLabel,
  scorePct,
} from "@/lib/mock-exam";
import { loadMockExamSessionDetail } from "@/lib/mock-exam-analytics";
import { getSession } from "@/lib/get-session";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function MockExamSessionPage({ params }: PageProps) {
  const auth = await getSession();
  if (!auth?.user?.id) {
    redirect("/mock-exam");
  }

  const { sessionId } = await params;
  const detail = await loadMockExamSessionDetail(auth.user.id, sessionId);
  if (!detail) notFound();

  const pct = scorePct(detail.correctCount, detail.gradableCount);
  const avgSecPerQ =
    detail.elapsedSec != null && detail.actualCount > 0
      ? Math.round(detail.elapsedSec / detail.actualCount)
      : null;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--muted)]">單次測驗分析</p>
            <h1 className="mt-1 text-xl font-semibold">
              {detail.nickname ?? "模擬考試"}
              <span className="ml-2 text-base font-normal text-[var(--muted)]">
                {mockExamTypeLabel(detail.questionType)}
              </span>
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {detail.finishedAt
                ? new Intl.DateTimeFormat("zh-TW", {
                    dateStyle: "full",
                    timeStyle: "short",
                  }).format(new Date(detail.finishedAt))
                : "—"}
              {detail.timedMode ? " · 計時模式" : " · 不限時"}
            </p>
          </div>
          <Link href="/mock-exam" className="text-sm no-underline hover:underline">
            ← 返回模擬考試
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-blue-50 px-4 py-3">
            <p className="text-xs text-blue-800">正確率</p>
            <p className="text-2xl font-semibold text-blue-950">
              {pct != null ? `${pct}%` : "—"}
            </p>
            <p className="text-xs text-blue-700">
              {detail.correctCount}/{detail.gradableCount} 題
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-600">作答</p>
            <p className="text-2xl font-semibold">{detail.answeredCount}</p>
            <p className="text-xs text-gray-600">/ {detail.actualCount} 題</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-600">用時</p>
            <p className="text-2xl font-semibold">
              {detail.elapsedSec != null ? formatDuration(detail.elapsedSec) : "—"}
            </p>
            {detail.timeLimitSec ? (
              <p className="text-xs text-gray-600">限時 {formatDuration(detail.timeLimitSec)}</p>
            ) : null}
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-600">平均用時</p>
            <p className="text-2xl font-semibold">
              {avgSecPerQ != null ? `${avgSecPerQ} 秒` : "—"}
            </p>
            <p className="text-xs text-gray-600">每題</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">分析圖表</h2>
        <div className="mt-4">
          <MockExamSingleSessionCharts
            breakdown={detail.breakdown}
            categoryStats={detail.categoryStats}
          />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">逐題明細</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">類別</th>
                <th className="py-2 pr-3 font-medium">題目</th>
                <th className="py-2 pr-3 font-medium">您的答案</th>
                <th className="py-2 pr-3 font-medium">參考答案</th>
                <th className="py-2 pr-3 font-medium">結果</th>
                <th className="py-2 font-medium">來源註記</th>
              </tr>
            </thead>
            <tbody>
              {detail.answers.map((a) => (
                <tr key={a.questionIndex} className="border-b border-[var(--border)] align-top">
                  <td className="py-3 pr-3">{a.questionIndex + 1}</td>
                  <td className="py-3 pr-3 whitespace-nowrap text-xs">{a.category}</td>
                  <td className="py-3 pr-3 max-w-md">{a.question}</td>
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {formatAnswerLabel(a.userAnswer, detail.questionType)}
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {a.revealed
                      ? formatAnswerLabel(a.referenceAnswer, detail.questionType)
                      : "—"}
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {!a.revealed ? (
                      <span className="text-[var(--muted)]">未確認</span>
                    ) : a.isCorrect === true ? (
                      <span className="text-green-700">答對</span>
                    ) : a.isCorrect === false ? (
                      <span className="text-red-600">答錯</span>
                    ) : (
                      <span className="text-[var(--muted)]">無法評分</span>
                    )}
                  </td>
                  <td className="py-3 text-xs text-[var(--muted)]">{a.sourceNote ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
