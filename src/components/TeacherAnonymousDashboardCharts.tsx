"use client";

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

import { KnowledgeRadarChart } from "@/components/KnowledgeRadarChart";
import type { AnonymousCohortDashboard } from "@/lib/teacher-anonymous-dashboard";

type Props = {
  data: AnonymousCohortDashboard;
};

function truncateLabel(text: string, max = 10): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function TeacherAnonymousDashboardCharts({ data }: Props) {
  const { summary, scoreBuckets, examTypeDistribution, categoryStats, knowledgeRadar, activityByWeek, feedback } =
    data;

  const categoryChart = categoryStats.slice(0, 12).map((c) => ({
    name: truncateLabel(c.category, 12),
    fullName: c.category,
    pct: c.pct,
    total: c.total,
  }));

  const typeChart = examTypeDistribution.map((t) => ({
    name: t.label,
    count: t.count,
  }));

  const activityChart = activityByWeek.map((w) => ({
    name: w.label.replace(/^\d{4}\s*/, ""),
    fullLabel: w.label,
    exams: w.exams,
    questions: w.questions,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="學員人數" value={String(summary.studentCount)} hint="角色為一般使用者" />
        <Kpi
          label="全體平均正確率"
          value={summary.cohortAvgScorePct != null ? `${summary.cohortAvgScorePct}%` : "—"}
          hint={
            summary.cohortMedianScorePct != null
              ? `中位數 ${summary.cohortMedianScorePct}%`
              : "尚無考試成績"
          }
        />
        <Kpi
          label="考試場次／提問"
          value={`${summary.totalExamSessions}／${summary.totalQuestionsAsked}`}
          hint={`有考試 ${summary.studentsWithExams} 人 · 有提問 ${summary.studentsWithQuestions} 人`}
        />
        <Kpi
          label="回答滿意度"
          value={
            feedback.satisfactionRate != null
              ? `${Math.round(feedback.satisfactionRate * 100)}%`
              : "—"
          }
          hint={
            feedback.ratedCount > 0
              ? `👍 ${feedback.upCount} · 👎 ${feedback.downCount}`
              : "尚無評分"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="學員平均分數分布（匿名）" subtitle="以每位學員「個人平均正確率」歸入區間，不含姓名／信箱">
          {scoreBuckets.every((b) => b.count === 0) ? (
            <Empty>尚無足以統計的考試成績</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={scoreBuckets} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} 人`, "人數"]} />
                <Bar dataKey="count" name="人數" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="題型場次分布" subtitle="全體已交卷場次">
          {typeChart.length === 0 ? (
            <Empty>尚無考試場次</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={typeChart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} 場`, "場次"]} />
                <Bar dataKey="count" name="場次" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="全體類別正確率（弱→強）" subtitle="彙總所有已評分作答，用於掌握共同弱點單元">
          {categoryChart.length === 0 ? (
            <Empty>尚無類別統計</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryChart} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(v: number, _n, item) => {
                    const t = (item?.payload as { total?: number })?.total;
                    return [`${v}%（n=${t ?? "—"}）`, "正確率"];
                  }}
                  labelFormatter={(_, p) =>
                    p?.[0]?.payload?.fullName ? String(p[0].payload.fullName) : ""
                  }
                />
                <Bar dataKey="pct" name="正確率" fill="#b45309" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="全體知識標籤雷達" subtitle="規則引擎依標籤彙總；數值不含個資">
          {knowledgeRadar.axes.length === 0 ? (
            <Empty>尚無知識標籤統計</Empty>
          ) : (
            <KnowledgeRadarChart radar={knowledgeRadar} />
          )}
        </Panel>
      </div>

      <Panel title="近週活動量（匿名）" subtitle="考試交卷數與提問數；不含可識別資訊">
        {activityChart.length === 0 ? (
          <Empty>尚無週活動資料</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={activityChart} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(_, p) =>
                  p?.[0]?.payload?.fullLabel ? String(p[0].payload.fullLabel) : ""
                }
              />
              <Legend />
              <Line type="monotone" dataKey="exams" name="考試場次" stroke="#1d4ed8" strokeWidth={2} dot={false} />
              <Line
                type="monotone"
                dataKey="questions"
                name="提問數"
                stroke="#be123c"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-slate-50 px-4 py-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--fg)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>;
}
