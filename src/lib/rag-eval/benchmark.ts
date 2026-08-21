/**
 * RAG Benchmark：彙整 Golden／FRC／策略比較的期末報告用總表。
 */

import type { CompareReport } from "@/lib/rag-eval/compare";

export type BenchmarkStepName = "golden" | "frc" | "compare";

export type BenchmarkStepResult = {
  name: BenchmarkStepName;
  ok: boolean;
  exitCode: number;
  summary?: string;
};

export type BenchmarkFrCSummary = {
  n: number;
  faithfulness_mean: number | null;
  relevance_mean: number | null;
  citation_accuracy_mean: number | null;
  frc_mean: number | null;
  pass: boolean | null;
};

export type BenchmarkGoldenSummary = {
  n: number;
  faithfulness_mean: number | null;
  answer_relevance_mean: number | null;
  citation_accuracy_mean: number | null;
  frc_mean: number | null;
  refuse_accuracy: number | null;
  pass: boolean | null;
};

export type BenchmarkCompareRow = {
  strategy: string;
  n: number;
  retrieval_hit_rate_mean: number | null;
  citation_accuracy_mean: number | null;
  faithfulness_mean: number | null;
  answer_relevance_mean: number | null;
  refuse_accuracy: number | null;
  latency_p50: number | null;
  latency_p95: number | null;
};

export type BenchmarkReport = {
  generated_at: string;
  framework: "rag-benchmark";
  dataset: {
    ready_count: number;
    target_total: number;
    version: string | null;
  };
  mode: {
    golden: string;
    frc: string;
    compare: string;
  };
  steps: BenchmarkStepResult[];
  golden: BenchmarkGoldenSummary | null;
  frc: BenchmarkFrCSummary | null;
  compare: {
    mode: string;
    generate_answers: boolean;
    enable_graph: boolean;
    strategies: BenchmarkCompareRow[];
  } | null;
  pass: boolean;
  notes: string[];
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(Math.round(n * 1000) / 1000);
}

export function extractGoldenSummary(raw: unknown): BenchmarkGoldenSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const summary = (o.summary ?? {}) as Record<string, unknown>;
  const frc = (o.frc ?? {}) as Record<string, unknown>;
  return {
    n: num(summary.n) ?? 0,
    faithfulness_mean: num(summary.faithfulness_mean) ?? num(frc.faithfulness_mean),
    answer_relevance_mean:
      num(summary.answer_relevance_mean) ?? num(frc.relevance_mean),
    citation_accuracy_mean: num(frc.citation_accuracy_mean),
    frc_mean: num(frc.frc_mean),
    refuse_accuracy: num(frc.refuse_accuracy),
    pass: typeof summary.pass === "boolean" ? summary.pass : null,
  };
}

export function extractFrcSummary(raw: unknown): BenchmarkFrCSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const summary = (o.summary ?? o) as Record<string, unknown>;
  return {
    n: num(o.n) ?? 0,
    faithfulness_mean: num(summary.faithfulness_mean),
    relevance_mean: num(summary.relevance_mean),
    citation_accuracy_mean: num(summary.citation_accuracy_mean),
    frc_mean: num(summary.frc_mean),
    pass: typeof summary.pass === "boolean" ? summary.pass : null,
  };
}

export function extractCompareSummary(raw: unknown): BenchmarkReport["compare"] {
  if (!raw || typeof raw !== "object") return null;
  const report = raw as CompareReport;
  if (!Array.isArray(report.summary)) return null;
  return {
    mode: report.mode,
    generate_answers: Boolean(report.generate_answers),
    enable_graph: Boolean(report.enable_graph),
    strategies: report.summary.map((s) => ({
      strategy: s.strategy,
      n: s.n,
      retrieval_hit_rate_mean: s.retrieval_hit_rate_mean,
      citation_accuracy_mean: s.citation_accuracy_mean,
      faithfulness_mean: s.faithfulness_mean,
      answer_relevance_mean: s.answer_relevance_mean,
      refuse_accuracy: s.refuse_accuracy,
      latency_p50: s.latency?.p50 ?? null,
      latency_p95: s.latency?.p95 ?? null,
    })),
  };
}

export function buildBenchmarkReport(params: {
  dataset: BenchmarkReport["dataset"];
  mode: BenchmarkReport["mode"];
  steps: BenchmarkStepResult[];
  goldenRaw: unknown;
  frcRaw: unknown;
  compareRaw: unknown;
  notes?: string[];
}): BenchmarkReport {
  const golden = extractGoldenSummary(params.goldenRaw);
  const frc = extractFrcSummary(params.frcRaw);
  const compare = extractCompareSummary(params.compareRaw);
  const stepsOk = params.steps.every((s) => s.ok);
  const goldenOk = golden?.pass !== false;
  const frcOk = frc?.pass !== false;
  return {
    generated_at: new Date().toISOString(),
    framework: "rag-benchmark",
    dataset: params.dataset,
    mode: params.mode,
    steps: params.steps,
    golden,
    frc,
    compare,
    pass: stepsOk && goldenOk && frcOk,
    notes: params.notes ?? [],
  };
}

export function formatBenchmarkMarkdown(report: BenchmarkReport): string {
  const lines: string[] = [
    "# RAG Benchmark 總表",
    "",
    `- 產生時間：${report.generated_at}`,
    `- 資料集：Golden ${report.dataset.ready_count}/${report.dataset.target_total}` +
      (report.dataset.version ? `（v${report.dataset.version}）` : ""),
    `- 整體 pass：${report.pass ? "true" : "false"}`,
    "",
    "## 步驟",
    "",
    "| 步驟 | 狀態 | 摘要 |",
    "|------|------|------|",
  ];
  for (const s of report.steps) {
    lines.push(
      `| \`${s.name}\` | ${s.ok ? "✅" : "❌"} | ${s.summary ?? "—"} |`,
    );
  }

  lines.push("", "## Golden／FRC（標註品質＋指標自洽）", "");
  lines.push("| 來源 | n | Faithfulness | Relevance | Citation | FRC | 拒答 | pass |");
  lines.push("|------|---|--------------|-----------|----------|-----|------|------|");
  if (report.golden) {
    const g = report.golden;
    lines.push(
      `| golden | ${g.n} | ${fmt(g.faithfulness_mean)} | ${fmt(g.answer_relevance_mean)} | ${fmt(g.citation_accuracy_mean)} | ${fmt(g.frc_mean)} | ${fmt(g.refuse_accuracy)} | ${g.pass ?? "—"} |`,
    );
  }
  if (report.frc) {
    const f = report.frc;
    lines.push(
      `| frc | ${f.n} | ${fmt(f.faithfulness_mean)} | ${fmt(f.relevance_mean)} | ${fmt(f.citation_accuracy_mean)} | ${fmt(f.frc_mean)} | — | ${f.pass ?? "—"} |`,
    );
  }

  if (report.compare) {
    lines.push("", "## 策略比較（Baseline／Contextual／Parent-Document）", "");
    lines.push(
      `- 模式：\`${report.compare.mode}\`；生成：${report.compare.generate_answers ? "yes" : "no"}；Graph：${report.compare.enable_graph ? "on" : "off"}`,
      "",
      "| strategy | n | Hit Rate | Citation | Faithfulness | Relevance | Refuse | p50 | p95 |",
      "|----------|---|----------|----------|--------------|-----------|--------|-----|-----|",
    );
    for (const s of report.compare.strategies) {
      lines.push(
        `| \`${s.strategy}\` | ${s.n} | ${fmt(s.retrieval_hit_rate_mean)} | ${fmt(s.citation_accuracy_mean)} | ${fmt(s.faithfulness_mean)} | ${fmt(s.answer_relevance_mean)} | ${fmt(s.refuse_accuracy)} | ${fmt(s.latency_p50)} | ${fmt(s.latency_p95)} |`,
      );
    }
  }

  if (report.notes.length) {
    lines.push("", "## 注意事項", "");
    for (const n of report.notes) lines.push(`- ${n}`);
    lines.push("");
  }

  lines.push(
    "",
    "## 重跑",
    "",
    "```bash",
    "npm run rag:benchmark",
    "RAG_BENCHMARK_COMPARE_LIMIT=50 npm run rag:benchmark",
    "RAG_BENCHMARK_COMPARE_MODE=live DATABASE_URL=... npm run rag:benchmark",
    "```",
    "",
  );

  return lines.join("\n");
}
