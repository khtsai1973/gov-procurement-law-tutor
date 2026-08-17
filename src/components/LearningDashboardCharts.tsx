"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { mockExamTypeLabel, type MockExamAnalyticsData } from "@/lib/mock-exam";
import type { PersonalFeedbackStats, WeakUnitStat } from "@/lib/learning-dashboard";
import { formatPercent } from "@/lib/answer-feedback-stats";

type LearningDashboardChartsProps = {
  exam: MockExamAnalyticsData;
  weakUnits: WeakUnitStat[];
  feedback: PersonalFeedbackStats;
};

function truncateLabel(text: string, max = 12): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const PIE_COLORS = ["#1d4ed8", "#b91c1c", "#94a3b8"];

export function LearningDashboardCharts({
  exam,
  weakUnits,
  feedback,
}: LearningDashboardChartsProps) {
  const { scoreTrend, summary, frequentWrong, typeDistribution } = exam;

  const trendChart = scoreTrend.map((p) => ({
    ...p,
    score: p.scorePct ?? 0,
    typeLabel: mockExamTypeLabel(p.questionType),
  }));

  const weakChart = weakUnits.slice(0, 10).map((u) => ({
    name: truncateLabel(u.category),
    fullName: u.category,
    wrong: u.wrongCount,
    pct: u.pct,
    total: u.total,
  }));

  const satisfactionPie = [
    { name: "滿意", value: feedback.upCount },
    { name: "不滿意", value: feedback.downCount },
    {
      name: "未評分",
      value: Math.max(0, feedback.totalAnswers - feedback.ratedCount),
    },
  ].filter((d) => d.value > 0);

  const monthlyChart = feedback.monthly.map((m) => ({
    label: m.label,
    up: m.upCount,
    down: m.downCount,
    rate: m.satisfactionRate != null ? Math.round(m.satisfactionRate * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-800">模考次數</p>
          <p className="text-2xl font-semibold text-blue-950">{summary.totalSessions}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-4 py-3">
          <p className="text-xs text-emerald-800">平均正確率</p>
          <p className="text-2xl font-semibold text-emerald-950">
            {summary.avgScorePct != null ? `${summary.avgScorePct}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-900">最佳正確率</p>
          <p className="text-2xl font-semibold text-amber-950">
            {summary.bestScorePct != null ? `${summary.bestScorePct}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-600">AI 回答滿意度</p>
          <p className="text-2xl font-semibold text-slate-900">
            {formatPercent(feedback.satisfactionRate)}
          </p>
          <p className="text-xs text-slate-500">
            {feedback.upCount} 讚 / {feedback.downCount} 倒讚（已評 {feedback.ratedCount}）
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">模考歷史分數趨勢</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          依完成時間排列
          {scoreTrend.length > 0 ? `（最近 ${scoreTrend.length} 次）` : ""}
        </p>
        {scoreTrend.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            尚無已完成的模擬考試。
            <Link href="/mock-exam" className="ml-1 underline">
              前往模考
            </Link>
          </p>
        ) : (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "正確率"]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as (typeof trendChart)[number] | undefined;
                    return row ? `${row.label} · ${row.typeLabel}` : "";
                  }}
                />
                <Line type="monotone" dataKey="score" stroke="#1d4ed8" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {typeDistribution.length > 0 ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            題型分布：
            {typeDistribution.map((t) => `${t.label} ${t.count}`).join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">常見錯題單元</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">依題庫分類統計答錯次數與正確率（弱項優先）</p>
        {weakUnits.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">完成並評分模考後，即可看到弱項單元。</p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weakChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={88}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "wrong" ? [value, "答錯次數"] : [value, name]
                  }
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as (typeof weakChart)[number] | undefined;
                    return row?.fullName ?? "";
                  }}
                />
                <Bar dataKey="wrong" fill="#b91c1c" name="答錯次數" />
              </BarChart>
            </ResponsiveContainer>
            <ul className="space-y-2 text-sm">
              {weakUnits.slice(0, 8).map((u) => (
                <li key={u.category} className="flex justify-between gap-3 border-b border-[var(--border)] pb-2">
                  <span className="min-w-0 break-words">{u.category}</span>
                  <span className="shrink-0 text-[var(--muted)]">
                    錯 {u.wrongCount}／{u.total} · {u.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {frequentWrong.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">常錯題目</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {frequentWrong.slice(0, 5).map((w) => (
                <li key={w.itemKey} className="text-[var(--muted)]">
                  <span className="font-medium text-[var(--fg)]">×{w.wrongCount}</span>{" "}
                  <span className="line-clamp-2">{w.question}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">AI 回答滿意度</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          來自問答頁的 👍／👎 回饋（個人統計）
          {" · "}
          <Link href="/my-questions" className="underline">
            查看提問紀錄
          </Link>
        </p>
        {feedback.totalAnswers === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">尚無問答紀錄。</p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">評分分布</h3>
              {satisfactionPie.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">尚無評分。</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={satisfactionPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name} ${value}`}
                    >
                      {satisfactionPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">月度滿意度</h3>
              {monthlyChart.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">尚無月度資料。</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="up" name="讚" fill="#1d4ed8" stackId="a" />
                    <Bar dataKey="down" name="倒讚" fill="#b91c1c" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
        {feedback.byModel.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">模型／模式</th>
                  <th className="py-2 pr-3 font-medium">已評</th>
                  <th className="py-2 pr-3 font-medium">讚</th>
                  <th className="py-2 pr-3 font-medium">倒讚</th>
                  <th className="py-2 font-medium">滿意度</th>
                </tr>
              </thead>
              <tbody>
                {feedback.byModel.map((m) => (
                  <tr key={m.model} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3 font-mono text-xs">{m.model}</td>
                    <td className="py-2 pr-3">{m.ratedCount}</td>
                    <td className="py-2 pr-3">{m.upCount}</td>
                    <td className="py-2 pr-3">{m.downCount}</td>
                    <td className="py-2">{formatPercent(m.satisfactionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
