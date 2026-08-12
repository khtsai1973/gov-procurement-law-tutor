#!/usr/bin/env node
/**
 * Golden Dataset 離線評測（Phase1 50 題）
 *
 * - 預設：以 gold_answer 自洽評分（驗證標註品質／must_include）
 * - GOLDEN_EVAL_MODE=modules：優先走既有確定性模組，否則用 gold_answer
 *
 *   npm run rag:eval:golden
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

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

function citationAccuracy(answer: string, articles: string[]): number | null {
  if (!articles.length) return null;
  const norm = (s: string) => s.replace(/\s+/g, "");
  const a = norm(answer);
  const hits = articles.filter((art) => {
    const n = norm(art);
    if (a.includes(n)) return true;
    const m = n.match(/第(\d+)條/);
    return m ? a.includes(`第${m[1]}條`) : false;
  });
  return hits.length / articles.length;
}

async function main() {
  const mode = (process.env.GOLDEN_EVAL_MODE || "gold").toLowerCase();
  const ds = loadGoldenDataset();
  const ready = listReadyGoldenItems(ds);
  const cov = summarizeGoldenCoverage(ds);
  console.error(
    `Golden eval mode=${mode} ready=${cov.ready} planned=${cov.planned}`,
  );

  const scored: RagEvalCaseScore[] = [];
  const citeScores: number[] = [];
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
    const row = scoreCase({ case: c, answer, contexts: c.contexts, latency_ms, model });
    scored.push(row);

    const cite = citationAccuracy(answer, item.expected_articles);
    if (cite != null) citeScores.push(cite);

    if (item.expected_behavior === "refuse") {
      refuseTotal += 1;
      if (answer.includes("非本主題的範圍")) refuseOk += 1;
    }
  }

  const fMean = mean(scored.map((s) => s.faithfulness));
  const rMean = mean(scored.map((s) => s.answer_relevance));
  const citeMean = citeScores.length ? mean(citeScores) : null;
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
      pass: fMean >= thresholds.faithfulness && rMean >= thresholds.answer_relevance,
    },
    cases: scored,
    latency: {
      note: `golden dataset phase1; citation_accuracy_mean=${citeMean}; refuse_accuracy=${refuseRate}; coverage=${JSON.stringify(cov.byCategory)}`,
    },
  };

  const outDir = process.env.RAG_EVAL_OUT_DIR || path.join(process.cwd(), "docs", "evidence");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `rag-golden-${stamp}.json`);
  const mdPath = path.join(outDir, `rag-golden-${stamp}.md`);
  const latestJson = path.join(outDir, "rag-golden-latest.json");
  const latestMd = path.join(outDir, "rag-golden-latest.md");

  const extra = [
    "",
    "## Golden 補充指標",
    "",
    `| Citation Accuracy（條號命中） | ${citeMean ?? "—"} |`,
    `| 拒答正確率 | ${refuseRate ?? "—"} |`,
    `| Phase1 ready | ${cov.ready} |`,
    `| Phase2 planned | ${cov.planned} |`,
    "",
  ].join("\n");

  const jsonText = JSON.stringify(
    { ...report, golden: { citation_accuracy_mean: citeMean, refuse_accuracy: refuseRate, coverage: cov } },
    null,
    2,
  );
  const mdText = formatRagEvalMarkdown(report) + extra;
  writeFileSync(jsonPath, jsonText);
  writeFileSync(mdPath, mdText);
  writeFileSync(latestJson, jsonText);
  writeFileSync(latestMd, mdText);

  console.log(jsonText);
  console.error(`Wrote ${mdPath}`);
  console.error(
    `faithfulness=${fMean} relevance=${rMean} citation=${citeMean} refuse=${refuseRate} pass=${report.summary.pass}`,
  );
  if (!report.summary.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
