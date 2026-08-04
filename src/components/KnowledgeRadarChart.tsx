"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { KnowledgeRadarSnapshot } from "@/lib/knowledge-radar";

type KnowledgeRadarChartProps = {
  radar: KnowledgeRadarSnapshot;
  compact?: boolean;
};

export function KnowledgeRadarChart({ radar, compact = false }: KnowledgeRadarChartProps) {
  const data = radar.axes.map((a) => ({
    tag: a.tag,
    pct: a.pct ?? 0,
    total: a.total,
    wrong: a.wrong,
  }));

  if (data.length === 0) {
    return <p className="text-sm text-[var(--muted)]">尚無足以繪製雷達圖的已評分知識標籤</p>;
  }

  const height = compact ? 260 : 320;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius={compact ? "65%" : "70%"}>
          <PolarGrid />
          <PolarAngleAxis dataKey="tag" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar
            name="正確率 %"
            dataKey="pct"
            stroke="#1d4ed8"
            fill="#3b82f6"
            fillOpacity={0.35}
          />
          <Tooltip
            formatter={(value: number, _name, item) => {
              const row = item?.payload as { total?: number; wrong?: number } | undefined;
              return [
                `${value}%（共 ${row?.total ?? "—"} 題／錯 ${row?.wrong ?? "—"}）`,
                "正確率",
              ];
            }}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
      {radar.weakTags.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          弱點標籤（規則引擎）：{radar.weakTags.join("、")}
        </p>
      ) : null}
    </div>
  );
}
