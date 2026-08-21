#!/usr/bin/env node
/**
 * Golden Dataset 離線評測（全部 ready 題，目前 200）— 含 FRC
 *
 * - 預設：以 gold_answer 自洽評分
 * - GOLDEN_EVAL_MODE=modules：優先走既有確定性模組
 *
 *   npm run rag:eval:golden
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { scoreFRC } from "../src/lib/rag-eval/frc";
import {
  goldenToRagEvalCase,
  listReadyGoldenItems,
  loadGoldenDataset,
  summarizeGoldenCoverage,
} from "../src/lib/rag-eval/golden";
import {
  formatRagEvalMarkdown,
  produceOfflineAnswer,
  scoreCase,
} from "../src/lib/rag-eval/run";
import { mean } from "../src/lib/rag-eval/metrics";
import type { RagEvalCaseScore, RagEvalReport } from "../src/lib/rag-eval/types";

async function main() {
  const mode = (process.env.GOLDEN_EVAL_MODE || "gold").toLowerCase();
  const ds = loadGoldenDataset();
  const ready = listReadyGoldenItems(ds);
  const cov = summarizeGoldenCoverage(ds);
  console.error(
    `Golden eval mode=${mode} ready=${cov.ready} planned=${cov.planned}`,
  );

  const scored: RagEvalCaseScore[] = [];
  const frcRows: Array<{
    id: string;
    faithfulness: number;
    relevance: number;
    citation_accuracy: number | null;
    frc_mean: number;
  }> = [];
  let refuseOk = 0;
  let refuseTotal = 0;

  for (const item of ready) {
    const c = goldenToRagEvalCase(item);
    const t0 = Date.now();
    let answer: string;
    let model: string;
    if (mode === "modules") {
      const offline = produceOfflineAnswer(c);
      answer = offline.answer;
      model = offline.model;
    } else {
      answer = item.gold_answer;
      model = "gold-self";
    }
    const latency_ms = Date.now() - t0;
    scored.push(
      scoreCase({ case: c, answer, contexts: c.contexts, latency_ms, model }),
    );

    const frc = scoreFRC({
      question: item.question,
      answer,
      contexts: c.contexts,
      mustInclude: c.must_include,
      relevanceKeywords: c.relevance_keywords,
      expectedArticles: item.expected_articles,
      expectedSources: item.expected_sources,
      behavior: item.expected_behavior,
      expectFragmentMarkers: false,
    });
    frcRows.push({
      id: item.id,
      faithfulness: frc.faithfulness,
      relevance: frc.relevance,
      citation_accuracy: frc.citation_accuracy,
      frc_mean: frc.frc_mean,
    });

    if (item.expected_behavior === "refuse") {
      refuseTotal += 1;
      if (answer.includes("非本主題的範圍")) refuseOk += 1;
    }
  }

  const fMean = mean(scored.map((s) => s.faithfulness));
  const rMean = mean(scored.map((s) => s.answer_relevance));
  const citeVals = frcRows
    .map((r) => r.citation_accuracy)
    .filter((n): n is number => n != null);
  const citeMean = citeVals.length ? mean(citeVals) : null;
  const frcMean = mean(frcRows.map((r) => r.frc_mean));
  const refuseRate = refuseTotal ? refuseOk / refuseTotal : null;

  const thresholds = {
    faithfulness: Number(process.env.GOLDEN_FAITHFULNESS_MIN ?? "0.7"),
    answer_relevance: Number(process.env.GOLDEN_RELEVANCE_MIN ?? "0.65"),
    ttfb_p95_ms: 500,
  };

  const report: RagEvalReport = {
    generated_at: new Date().toISOString(),
    mode: "offline",
    framework: "ragas-inspired-ts",
    thresholds,
    summary: {
      n: scored.length,
      faithfulness_mean: fMean,
      answer_relevance_mean: rMean,
      context_recall_mean: mean(
        scored.map((s) => s.context_recall).filter((n): n is number => n != null),
      ),
      pass:
        fMean >= thresholds.faithfulness &&
        rMean >= thresholds.answer_relevance,
    },
    cases: scored,
    latency: {
      note: `golden FRC; citation_accuracy_mean=${citeMean}; frc_mean=${frcMean}; refuse_accuracy=${refuseRate}`,
    },
  };

  const outDir =
    process.env.RAG_EVAL_OUT_DIR || path.join(process.cwd(), "docs", "evidence");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `rag-golden-${stamp}.json`);
  const mdPath = path.join(outDir, `rag-golden-${stamp}.md`);

  const extra = [
    "",
    "## FRC（Faithfulness + Relevance + Citation）",
    "",
    `| Faithfulness | ${fMean} |`,
    `| Relevance | ${rMean} |`,
    `| Citation Accuracy | ${citeMean ?? "—"} |`,
    `| **FRC mean** | **${frcMean}** |`,
    `| 拒答正確率 | ${refuseRate ?? "—"} |`,
    "",
  ].join("\n");

  const jsonText = JSON.stringify(
    {
      ...report,
      frc: {
        faithfulness_mean: fMean,
        relevance_mean: rMean,
        citation_accuracy_mean: citeMean,
        frc_mean: frcMean,
        refuse_accuracy: refuseRate,
        cases: frcRows,
        coverage: cov,
      },
    },
    null,
    2,
  );
  const mdText = formatRagEvalMarkdown(report) + extra;
  writeFileSync(jsonPath, jsonText);
  writeFileSync(mdPath, mdText);
  writeFileSync(path.join(outDir, "rag-golden-latest.json"), jsonText);
  writeFileSync(path.join(outDir, "rag-golden-latest.md"), mdText);

  console.log(jsonText);
  console.error(`Wrote ${mdPath}`);
  console.error(
    `F=${fMean} R=${rMean} C=${citeMean} FRC=${frcMean} refuse=${refuseRate} pass=${report.summary.pass}`,
  );
  if (!report.summary.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
