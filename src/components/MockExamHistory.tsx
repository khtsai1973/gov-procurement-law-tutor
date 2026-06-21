import Link from "next/link";

import {
  formatDuration,
  mockExamTypeLabel,
  type MockExamHistoryRow,
} from "@/lib/mock-exam";

type MockExamHistoryProps = {
  records: MockExamHistoryRow[];
};

export function MockExamHistory({ records }: MockExamHistoryProps) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">測驗紀錄</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">尚無紀錄，完成一次模擬考試後會顯示於此。</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="text-base font-semibold">測驗紀錄</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">最近 {records.length} 次</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted)]">
              <th className="py-2 pr-3 font-medium">日期</th>
              <th className="py-2 pr-3 font-medium">暱稱</th>
              <th className="py-2 pr-3 font-medium">題型</th>
              <th className="py-2 pr-3 font-medium">題數</th>
              <th className="py-2 pr-3 font-medium">成績</th>
              <th className="py-2 pr-3 font-medium">用時</th>
              <th className="py-2 pr-3 font-medium">模式</th>
              <th className="py-2 font-medium">分析</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row) => {
              const scoreText =
                row.gradableCount > 0
                  ? `${row.correctCount}/${row.gradableCount}`
                  : `${row.answeredCount} 題已答`;
              const pct =
                row.gradableCount > 0
                  ? Math.round((row.correctCount / row.gradableCount) * 100)
                  : null;
              const timeText =
                row.elapsedSec != null
                  ? formatDuration(row.elapsedSec)
                  : row.timeLimitSec != null
                    ? formatDuration(row.timeLimitSec)
                    : "—";

              return (
                <tr key={row.id} className="border-b border-[var(--border)] align-top">
                  <td className="py-3 pr-3 whitespace-nowrap text-xs text-[var(--muted)]">
                    {new Intl.DateTimeFormat("zh-TW", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(row.finishedAt ?? row.startedAt))}
                  </td>
                  <td className="py-3 pr-3">{row.nickname ?? "—"}</td>
                  <td className="py-3 pr-3 whitespace-nowrap">{mockExamTypeLabel(row.questionType)}</td>
                  <td className="py-3 pr-3">{row.actualCount}</td>
                  <td className="py-3 pr-3">
                    <span className="font-medium">{scoreText}</span>
                    {pct != null ? (
                      <span className="ml-1 text-xs text-[var(--muted)]">({pct}%)</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 whitespace-nowrap">{timeText}</td>
                  <td className="py-3 pr-3 whitespace-nowrap text-xs">
                    {row.timedMode ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">計時</span>
                    ) : (
                      <span className="text-[var(--muted)]">不限時</span>
                    )}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <Link
                      href={`/mock-exam/${row.id}`}
                      className="text-xs font-medium no-underline hover:underline"
                    >
                      查看
                      {pct != null ? ` (${pct}%)` : ""}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
