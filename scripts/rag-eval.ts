#!/usr/bin/env node
/**
 * RAG 評測（Ragas 風格 Faithfulness / Answer Relevance）
 *
 *   npm run rag:eval
 *   RAG_EVAL_MODE=live npm run rag:eval   # 需 DATABASE_URL
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  formatRagEvalMarkdown,
  runLiveRagEval,
  runOfflineRagEval,
} from "../src/lib/rag-eval/run";

async function main() {
  const mode = (process.env.RAG_EVAL_MODE || "offline").toLowerCase();
  const outDir = process.env.RAG_EVAL_OUT_DIR || path.join(process.cwd(), "docs", "evidence");
  mkdirSync(outDir, { recursive: true });

  console.error(`RAG eval mode=${mode}`);
  const report =
    mode === "live" ? await runLiveRagEval() : await runOfflineRagEval();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `rag-eval-${stamp}.json`);
  const mdPath = path.join(outDir, `rag-eval-${stamp}.md`);
  const latestJson = path.join(outDir, "rag-eval-latest.json");
  const latestMd = path.join(outDir, "rag-eval-latest.md");

  const jsonText = JSON.stringify(report, null, 2);
  const mdText = formatRagEvalMarkdown(report);
  writeFileSync(jsonPath, jsonText);
  writeFileSync(mdPath, mdText);
  writeFileSync(latestJson, jsonText);
  writeFileSync(latestMd, mdText);

  console.log(jsonText);
  console.error(`Wrote ${mdPath}`);
  console.error(
    `faithfulness=${report.summary.faithfulness_mean} relevance=${report.summary.answer_relevance_mean} pass=${report.summary.pass}`,
  );

  if (!report.summary.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
