"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { KnowledgeRadarChart } from "@/components/KnowledgeRadarChart";
import type { KnowledgeRadarSnapshot } from "@/lib/knowledge-radar";
import type { MockExamAnswerBreakdown, MockExamCategoryStat } from "@/lib/mock-exam";

const PIE_COLORS = ["#16a34a", "#dc2626", "#9ca3af", "#f59e0b"];

type MockExamSingleSessionChartsProps = {
  breakdown: MockExamAnswerBreakdown;
  categoryStats: MockExamCategoryStat[];
  radar?: KnowledgeRadarSnapshot | null;
  compact?: boolean;
};

function truncateLabel(text: string, max = 10): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function MockExamSingleSessionCharts({
  breakdown,
  categoryStats,
  radar = null,
  compact = false,
}: MockExamSingleSessionChartsProps) {
  const pieData = [
    { name: "答對", value: breakdown.correct },
    { name: "答錯", value: breakdown.wrong },
    { name: "未確認", value: breakdown.unrevealed },
    { name: "無法評分", value: breakdown.ungradable },
  ].filter((d) => d.value > 0);

  const categoryChart = categoryStats.map((c) => ({
    name: truncateLabel(c.category, compact ? 8 : 12),
    fullName: c.category,
    pct: c.pct,
    correct: c.correct,
    total: c.total,
  }));

  const chartHeight = compact ? 220 : 280;

  return (
    <div className="space-y-6">
      <div className={`grid gap-6 ${compact ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h3 className="text-sm font-semibold">作答結果分布</h3>
          {pieData.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">尚無可分析的作答資料</p>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={compact ? 70 : 90}
                  label={({ name, value }) => `${name} ${value}`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border)] p-4">
          <h3 className="text-sm font-semibold">各類別正確率</h3>
          {categoryChart.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">尚無已評分的類別資料</p>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={categoryChart} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "正確率"]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullName ? String(payload[0].payload.fullName) : ""
                  }
                />
                <Bar dataKey="pct" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {radar && radar.axes.length > 0 ? (
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h3 className="text-sm font-semibold">知識標籤雷達圖（規則引擎）</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            依題目知識標籤統計正確率；交卷後 AI 建議以此弱點標籤為依據。
          </p>
          <div className="mt-3">
            <KnowledgeRadarChart radar={radar} compact={compact} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
