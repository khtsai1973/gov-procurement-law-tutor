/**
 * Baseline / Contextual / Parent-Document RAG 比較管線。
 */

import { scoreCitationAccuracyFr } from "@/lib/rag-eval/frc";
import {
  latencySummary,
  scoreRetrievalHitRate,
} from "@/lib/rag-eval/compare-metrics";
import {
  goldenToRagEvalCase,
  listReadyGoldenItems,
} from "@/lib/rag-eval/golden";
import type { GoldenItem } from "@/lib/rag-eval/golden-types";
import { mean, scoreAnswerRelevance, scoreFaithfulness } from "@/lib/rag-eval/metrics";
import type { RagStrategy } from "@/lib/rag";

export const COMPARE_STRATEGIES: RagStrategy[] = [
  "baseline",
  "contextual",
  "parent_contextual",
  "combined",
];

export const COMPARE_STRATEGY_LABELS: Record<RagStrategy, string> = {
  baseline: "Baseline",
  contextual: "Contextual",
  parent_contextual: "Parent",
  combined: "Combined",
};

export type CompareCaseRow = {
  id: string;
  strategy: RagStrategy;
  retrieval_hit_rate: number | null;
  citation_accuracy: number | null;
  faithfulness: number | null;
  answer_relevance: number | null;
  refuse_ok: boolean | null;
  latency_ms: number;
  mode?: string;
  chunk_count: number;
};

export type CompareStrategySummary = {
  strategy: RagStrategy;
  n: number;
  retrieval_hit_rate_mean: number | null;
  citation_accuracy_mean: number | null;
  faithfulness_mean: number | null;
  answer_relevance_mean: number | null;
  refuse_accuracy: number | null;
  latency: ReturnType<typeof latencySummary>;
};

export type CompareReport = {
  generated_at: string;
  mode: "live" | "fixture";
  generate_answers: boolean;
  enable_graph: boolean;
  strategies: RagStrategy[];
  summary: CompareStrategySummary[];
  cases: CompareCaseRow[];
  notes: string[];
};

function avg(nums: Array<number | null | undefined>): number | null {
  const v = nums.filter((n): n is number => typeof n === "number");
  return v.length ? mean(v) : null;
}

export function summarizeStrategy(
  strategy: RagStrategy,
  rows: CompareCaseRow[],
): CompareStrategySummary {
  const mine = rows.filter((r) => r.strategy === strategy);
  const refuseRows = mine.filter((r) => r.refuse_ok != null);
  const refuseOk = refuseRows.filter((r) => r.refuse_ok).length;
  return {
    strategy,
    n: mine.length,
    retrieval_hit_rate_mean: avg(mine.map((r) => r.retrieval_hit_rate)),
    citation_accuracy_mean: avg(mine.map((r) => r.citation_accuracy)),
    faithfulness_mean: avg(mine.map((r) => r.faithfulness)),
    answer_relevance_mean: avg(mine.map((r) => r.answer_relevance)),
    refuse_accuracy: refuseRows.length ? refuseOk / refuseRows.length : null,
    latency: latencySummary(mine.map((r) => r.latency_ms)),
  };
}

export function scoreRetrievedAgainstGolden(params: {
  item: GoldenItem;
  retrieved: Array<{
    slug?: string | null;
    title?: string | null;
    articleKey?: string | null;
    content?: string | null;
  }>;
  answer?: string | null;
}): Pick<
  CompareCaseRow,
  "retrieval_hit_rate" | "citation_accuracy" | "faithfulness" | "answer_relevance" | "refuse_ok"
> {
  const { item, retrieved, answer } = params;
  const hit = scoreRetrievalHitRate({
    retrieved,
    expectedSources: item.expected_sources,
    expectedArticles: item.expected_articles,
  });

  if (item.expected_behavior === "refuse") {
    const ans = answer ?? "";
    const ok = ans.includes("非本主題的範圍");
    return {
      retrieval_hit_rate: null,
      citation_accuracy: null,
      faithfulness: ok ? 1 : 0,
      answer_relevance: ok ? 1 : 0,
      refuse_ok: ok,
    };
  }

  if (!answer) {
    return {
      retrieval_hit_rate: hit,
      citation_accuracy: null,
      faithfulness: null,
      answer_relevance: null,
      refuse_ok: null,
    };
  }

  const evalCase = goldenToRagEvalCase(item);
  const contexts = retrieved.map((r) => r.content ?? "").filter(Boolean);
  const faithfulness = scoreFaithfulness({
    answer,
    contexts: contexts.length ? contexts : evalCase.contexts,
    mustInclude: evalCase.must_include,
  });
  const answer_relevance = scoreAnswerRelevance({
    question: item.question,
    answer,
    relevanceKeywords: evalCase.relevance_keywords,
  });
  const citation_accuracy = scoreCitationAccuracyFr(answer, item.expected_articles, {
    expectedSources: item.expected_sources,
    behavior: item.expected_behavior,
    expectFragmentMarkers: Boolean(answer.match(/\[\s*片段/)),
  });

  return {
    retrieval_hit_rate: hit,
    citation_accuracy,
    faithfulness,
    answer_relevance,
    refuse_ok: null,
  };
}

export function formatCompareMarkdown(report: CompareReport): string {
  const labels = report.strategies.map(
    (s) => COMPARE_STRATEGY_LABELS[s] ?? s,
  );
  const byStrategy = new Map(report.summary.map((s) => [s.strategy, s]));

  const metricRows: Array<{
    name: string;
    pick: (s: CompareStrategySummary) => number | null | undefined;
  }> = [
    { name: "Retrieval Hit Rate", pick: (s) => s.retrieval_hit_rate_mean },
    { name: "Faithfulness", pick: (s) => s.faithfulness_mean },
    { name: "Relevance", pick: (s) => s.answer_relevance_mean },
    { name: "Citation Accuracy", pick: (s) => s.citation_accuracy_mean },
    {
      name: "Latency p50 (ms)",
      pick: (s) => s.latency.p50,
    },
    {
      name: "Latency p95 (ms)",
      pick: (s) => s.latency.p95,
    },
  ];

  const lines: string[] = [
    "# RAG 策略比較報告",
    "",
    `- 產生時間：${report.generated_at}`,
    `- 模式：\`${report.mode}\``,
    `- 生成回答：${report.generate_answers ? "yes" : "no（僅檢索）"}`,
    `- GraphRAG：${report.enable_graph ? "on（Combined 一律開；Parent 依設定）" : "off（Combined 仍開 Graph）"}`,
    `- 題數／策略：n≈${report.summary[0]?.n ?? "—"} × ${report.strategies.length}`,
    "",
    "## 指標對照表（實測）",
    "",
    `| 指標 | ${labels.join(" | ")} |`,
    `|------|${labels.map(() => "------").join("|")}|`,
  ];

  for (const row of metricRows) {
    const cells = report.strategies.map((st) => {
      const s = byStrategy.get(st);
      return s ? fmt(row.pick(s)) : "—";
    });
    lines.push(`| ${row.name} | ${cells.join(" | ")} |`);
  }

  lines.push(
    "",
    "## 摘要（列為策略）",
    "",
    "| strategy | Hit Rate | Citation | Faithfulness | Relevance | Refuse | Latency p50 | Latency p95 |",
    "|----------|----------|----------|--------------|-----------|--------|-------------|-------------|",
  );
  for (const s of report.summary) {
    lines.push(
      `| \`${s.strategy}\` | ${fmt(s.retrieval_hit_rate_mean)} | ${fmt(s.citation_accuracy_mean)} | ${fmt(s.faithfulness_mean)} | ${fmt(s.answer_relevance_mean)} | ${fmt(s.refuse_accuracy)} | ${fmt(s.latency.p50)} | ${fmt(s.latency.p95)} |`,
    );
  }
  lines.push("", "## 策略定義", "");
  lines.push(
    "- **Baseline**：僅 Child 命中，不做 Parent 展開／細則擴充／Graph",
    "- **Contextual**：Child 命中＋依條號擴充關聯施行細則（不展開母法 Parent）",
    "- **Parent**：Child→Parent 展開＋細則擴充（比較實驗預設關閉 Graph）",
    "- **Combined**：Parent＋Contextual＋GraphRAG（≈生產問答管線）",
    "",
  );
  if (report.notes.length) {
    lines.push("## 注意事項", "");
    for (const n of report.notes) lines.push(`- ${n}`);
    lines.push("");
  }
  return lines.join("\n");
}

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return typeof n === "number" ? String(Math.round(n * 1000) / 1000) : "—";
}

export function parseStrategies(raw?: string): RagStrategy[] {
  if (!raw?.trim()) return [...COMPARE_STRATEGIES];
  const allowed = new Set<string>(COMPARE_STRATEGIES);
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is RagStrategy => allowed.has(s));
  return list.length ? list : [...COMPARE_STRATEGIES];
}

/** Whether GraphRAG should run for this strategy in a compare pass. */
export function strategyUsesGraph(
  strategy: RagStrategy,
  enableGraphFlag: boolean,
): boolean {
  if (strategy === "combined") return true;
  if (strategy === "parent_contextual") return enableGraphFlag;
  return false;
}

export function selectGoldenForCompare(limit?: number): GoldenItem[] {
  const ready = listReadyGoldenItems();
  if (!limit || limit <= 0) return ready;
  return ready.slice(0, limit);
}
