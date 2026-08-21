import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBenchmarkReport,
  extractCompareSummary,
  extractFrcSummary,
  extractGoldenSummary,
  formatBenchmarkMarkdown,
} from "./benchmark";

describe("rag benchmark", () => {
  it("extracts golden / frc / compare summaries", () => {
    const golden = extractGoldenSummary({
      summary: {
        n: 200,
        faithfulness_mean: 0.96,
        answer_relevance_mean: 0.97,
        pass: true,
      },
      frc: {
        citation_accuracy_mean: 0.95,
        frc_mean: 0.96,
        refuse_accuracy: 1,
      },
    });
    assert.equal(golden?.n, 200);
    assert.equal(golden?.citation_accuracy_mean, 0.95);
    assert.equal(golden?.pass, true);

    const frc = extractFrcSummary({
      n: 200,
      summary: {
        faithfulness_mean: 0.96,
        relevance_mean: 0.97,
        citation_accuracy_mean: 0.95,
        frc_mean: 0.96,
        pass: true,
      },
    });
    assert.equal(frc?.pass, true);
    assert.equal(frc?.frc_mean, 0.96);

    const compare = extractCompareSummary({
      mode: "fixture",
      generate_answers: false,
      enable_graph: false,
      summary: [
        {
          strategy: "baseline",
          n: 200,
          retrieval_hit_rate_mean: 0.5,
          citation_accuracy_mean: null,
          faithfulness_mean: null,
          answer_relevance_mean: null,
          refuse_accuracy: 1,
          latency: { n: 200, mean: 1, p50: 1, p95: 2 },
        },
      ],
    });
    assert.equal(compare?.strategies[0]?.strategy, "baseline");
    assert.equal(compare?.strategies[0]?.latency_p50, 1);
  });

  it("builds markdown report with pass aggregation", () => {
    const report = buildBenchmarkReport({
      dataset: { ready_count: 200, target_total: 200, version: "2.0.1-200" },
      mode: { golden: "gold", frc: "golden-offline", compare: "fixture" },
      steps: [
        { name: "golden", ok: true, exitCode: 0, summary: "pass" },
        { name: "frc", ok: true, exitCode: 0, summary: "pass" },
        { name: "compare", ok: true, exitCode: 0, summary: "fixture n=200" },
      ],
      goldenRaw: {
        summary: { n: 200, faithfulness_mean: 0.9, answer_relevance_mean: 0.9, pass: true },
        frc: { citation_accuracy_mean: 0.9, frc_mean: 0.9, refuse_accuracy: 1 },
      },
      frcRaw: {
        n: 200,
        summary: {
          faithfulness_mean: 0.9,
          relevance_mean: 0.9,
          citation_accuracy_mean: 0.9,
          frc_mean: 0.9,
          pass: true,
        },
      },
      compareRaw: {
        mode: "fixture",
        generate_answers: false,
        enable_graph: false,
        summary: [],
      },
      notes: ["offline benchmark"],
    });
    assert.equal(report.pass, true);
    const md = formatBenchmarkMarkdown(report);
    assert.match(md, /RAG Benchmark/);
    assert.match(md, /200\/200/);
    assert.match(md, /offline benchmark/);
  });
});
