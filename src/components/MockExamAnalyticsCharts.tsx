"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  mockExamTypeLabel,
  type MockExamAnalyticsData,
} from "@/lib/mock-exam";

type MockExamAnalyticsChartsProps = {
  data: MockExamAnalyticsData;
};

function truncateLabel(text: string, max = 10): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function MockExamAnalyticsCharts({ data }: MockExamAnalyticsChartsProps) {
  const { scoreTrend, categoryStats, typeDistribution, summary, frequentWrong } = data;

  if (summary.totalSessions === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">多次測驗分析</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">完成至少一次模擬考試後，即可查看趨勢圖表。</p>
      </div>
    );
  }

  const trendChart = scoreTrend.map((p) => ({
    ...p,
    score: p.scorePct ?? 0,
    typeLabel: mockExamTypeLabel(p.questionType),
  }));

  const categoryChart = categoryStats.slice(0, 10).map((c) => ({
    name: truncateLabel(c.category),
    fullName: c.category,
    pct: c.pct,
    correct: c.correct,
    total: c.total,
  }));

  const typeChart = typeDistribution.map((t) => ({
    name: t.label,
    count: t.count,
  }));

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="text-base font-semibold">多次測驗分析</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        共 {summary.totalSessions} 次測驗
        {summary.avgScorePct != null ? ` · 平均正確率 ${summary.avgScorePct}%` : ""}
        {summary.bestScorePct != null ? ` · 最佳 ${summary.bestScorePct}%` : ""}
      </p>

      <div className="mt-6 space-y-8">
        <div>
          <h3 className="text-sm font-semibold">成績趨勢</h3>
          <p className="text-xs text-[var(--muted)]">依完成時間排列（最近 {scoreTrend.length} 次）</p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "正確率"]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    if (!row) return String(label);
                    return `${label} · ${row.typeLabel}${row.timedMode ? " · 計時" : ""}`;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="正確率"
                  stroke="#1d4ed8"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {scoreTrend.length >= 2 ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {scoreTrend.slice(-5).reverse().map((p) => (
                <Link
                  key={p.sessionId}
                  href={`/mock-exam/${p.sessionId}`}
                  className="rounded-full border border-[var(--border)] px-2 py-0.5 no-underline hover:bg-gray-50"
                >
                  {p.label} {p.scorePct != null ? `${p.scorePct}%` : "—"}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">各類別正確率（累計）</h3>
            {categoryChart.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">尚無類別資料</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryChart} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "正確率"]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullName ? String(payload[0].payload.fullName) : ""
                    }
                  />
                  <Bar dataKey="pct" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">題型分布</h3>
            {typeChart.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">尚無資料</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={typeChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="測驗次數" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {frequentWrong.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">常錯題目</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {frequentWrong.map((item) => (
                <li
                  key={item.itemKey}
                  className="rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <span className="mr-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                    錯 {item.wrongCount} 次
                  </span>
                  <span className="text-[var(--muted)]">{item.question.slice(0, 120)}</span>
                  {item.question.length > 120 ? "…" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
