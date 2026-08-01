"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatPercent } from "@/lib/answer-feedback-stats";
import type { TeacherClassDashboard } from "@/lib/teacher-dashboard";

function truncateLabel(text: string, max = 12): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

type Props = {
  data: TeacherClassDashboard;
};

export function TeacherClassDashboardCharts({ data }: Props) {
  const { summary, scoreDistribution, leaderboard, weakUnits, students } = data;

  const weakChart = weakUnits.slice(0, 10).map((u) => ({
    name: truncateLabel(u.category),
    fullName: u.category,
    wrong: u.wrongCount,
    pct: u.pct,
    total: u.total,
  }));

  const leaderChart = leaderboard.map((s) => ({
    name: truncateLabel(s.label, 10),
    fullName: s.label,
    userId: s.userId,
    avg: s.avgScorePct,
    exams: s.examSessionCount,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-800">學員人數</p>
          <p className="text-2xl font-semibold text-blue-950">{summary.studentCount}</p>
          <p className="text-xs text-blue-700">
            有模考 {summary.withExamCount} · 有提問 {summary.withQuestionCount}
          </p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-4 py-3">
          <p className="text-xs text-emerald-800">全班平均正確率</p>
          <p className="text-2xl font-semibold text-emerald-950">
            {summary.classAvgScorePct != null ? `${summary.classAvgScorePct}%` : "—"}
          </p>
          <p className="text-xs text-emerald-700">模考場次合計 {summary.totalExamSessions}</p>
        </div>
        <div className="rounded-lg bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-900">提問總數</p>
          <p className="text-2xl font-semibold text-amber-950">{summary.totalQuestions}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-600">AI 回答滿意度（全班）</p>
          <p className="text-2xl font-semibold text-slate-900">
            {formatPercent(summary.satisfactionRate)}
          </p>
          <p className="text-xs text-slate-500">
            {summary.upCount} 讚 / {summary.downCount} 倒讚（已評 {summary.ratedCount}）
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h2 className="text-base font-semibold">學員平均正確率分布</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">依各學員歷史模考平均正確率分組</p>
          {withScoresEmpty(summary) ? (
            <p className="mt-4 text-sm text-[var(--muted)]">尚無學員完成可評分的模考。</p>
          ) : (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [v, "人數"]} />
                  <Bar dataKey="count" name="人數" fill="#1d4ed8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h2 className="text-base font-semibold">平均分領先學員</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">點選可查看該員儀表板</p>
          {leaderChart.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">尚無資料。</p>
          ) : (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={leaderChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "平均正確率"]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as (typeof leaderChart)[number] | undefined;
                      return row?.fullName ?? "";
                    }}
                  />
                  <Bar dataKey="avg" name="平均正確率" fill="#047857" />
                </BarChart>
              </ResponsiveContainer>
              <ul className="mt-3 space-y-1 text-sm">
                {leaderboard.slice(0, 5).map((s) => (
                  <li key={s.userId} className="flex justify-between gap-2">
                    <Link
                      href={`/teacher/dashboard?user=${s.userId}`}
                      className="no-underline hover:underline"
                    >
                      {s.label}
                    </Link>
                    <span className="text-[var(--muted)]">
                      {s.avgScorePct}% · {s.examSessionCount} 場
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">全班常見錯題單元</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">彙整所有學員已評分模考之弱項分類</p>
        {weakUnits.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">尚無可分析的錯題單元。</p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weakChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number) => [v, "答錯次數"]}
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
                <li
                  key={u.category}
                  className="flex justify-between gap-3 border-b border-[var(--border)] pb-2"
                >
                  <span className="min-w-0 break-words">{u.category}</span>
                  <span className="shrink-0 text-[var(--muted)]">
                    錯 {u.wrongCount}／{u.total} · {u.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">學員一覽</h2>
          <Link href="/teacher/students" className="text-sm no-underline hover:underline">
            前往成績表 →
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="py-2 pr-3 font-medium">學員</th>
                <th className="py-2 pr-3 font-medium">模考</th>
                <th className="py-2 pr-3 font-medium">平均</th>
                <th className="py-2 pr-3 font-medium">最高</th>
                <th className="py-2 pr-3 font-medium">提問</th>
                <th className="py-2 font-medium">儀表板</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-[var(--muted)]">
                    尚無學員。
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.userId} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{s.nickname ?? s.name ?? "（未設定暱稱）"}</div>
                      <div className="text-xs text-[var(--muted)]">{s.email}</div>
                    </td>
                    <td className="py-2 pr-3">{s.examSessionCount}</td>
                    <td className="py-2 pr-3">
                      {s.avgScorePct != null ? `${s.avgScorePct}%` : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {s.bestScorePct != null ? `${s.bestScorePct}%` : "—"}
                    </td>
                    <td className="py-2 pr-3">{s.questionCount}</td>
                    <td className="py-2">
                      <Link
                        href={`/teacher/dashboard?user=${s.userId}`}
                        className="no-underline hover:underline"
                      >
                        檢視
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function withScoresEmpty(summary: TeacherClassDashboard["summary"]): boolean {
  return summary.withExamCount === 0;
}
