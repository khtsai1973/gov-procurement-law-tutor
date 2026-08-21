#!/usr/bin/env node
/**
 * RAG Benchmark（期末報告總表）
 *
 * 串接 Golden 離線評測、FRC、Baseline／Contextual／Parent-Document 比較，
 * 產出單一 `docs/evidence/rag-benchmark-latest.{md,json}`。
 *
 *   npm run rag:benchmark
 *
 * Env:
 *   RAG_BENCHMARK_STEPS=golden,frc,compare
 *   RAG_BENCHMARK_COMPARE_LIMIT=0   # 0=全部 ready（預設）
 *   RAG_BENCHMARK_COMPARE_MODE=fixture|live
 *   RAG_BENCHMARK_FAIL_FAST=1
 *   RAG_COMPARE_GENERATE=0|1
 *   RAG_COMPARE_ENABLE_GRAPH=0|1
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  buildBenchmarkReport,
  formatBenchmarkMarkdown,
  type BenchmarkStepName,
  type BenchmarkStepResult,
} from "../src/lib/rag-eval/benchmark";
import { loadGoldenDataset, summarizeGoldenCoverage } from "../src/lib/rag-eval/golden";

const ROOT = process.cwd();
const OUT_DIR =
  process.env.RAG_EVAL_OUT_DIR || path.join(ROOT, "docs", "evidence");

function parseSteps(raw?: string): BenchmarkStepName[] {
  const allowed = new Set<BenchmarkStepName>(["golden", "frc", "compare"]);
  const list = (raw || "golden,frc,compare")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is BenchmarkStepName => allowed.has(s as BenchmarkStepName));
  return list.length ? list : ["golden", "frc", "compare"];
}

function readJsonSafe(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function runNpmScript(
  name: BenchmarkStepName,
  script: string,
  extraEnv: Record<string, string>,
): BenchmarkStepResult {
  console.error(`\n=== benchmark:${name} ===`);
  const r = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  const ok = r.status === 0;
  console.error(`benchmark:${name} exit=${r.status ?? "?"} ok=${ok}`);
  return { name, ok, exitCode: r.status ?? 1 };
}

async function main() {
  const steps = parseSteps(process.env.RAG_BENCHMARK_STEPS);
  const failFast =
    process.env.RAG_BENCHMARK_FAIL_FAST !== "0" &&
    process.env.RAG_BENCHMARK_FAIL_FAST !== "false";

  const ds = loadGoldenDataset();
  const cov = summarizeGoldenCoverage(ds);
  const compareLimit = process.env.RAG_BENCHMARK_COMPARE_LIMIT ?? "0";
  const compareMode =
    (process.env.RAG_BENCHMARK_COMPARE_MODE || "").toLowerCase() ||
    (process.env.DATABASE_URL?.trim() ? "live" : "fixture");

  mkdirSync(OUT_DIR, { recursive: true });

  const stepResults: BenchmarkStepResult[] = [];
  let goldenRaw: unknown = null;
  let frcRaw: unknown = null;
  let compareRaw: unknown = null;

  for (const step of steps) {
    if (step === "golden") {
      const res = runNpmScript("golden", "rag:eval:golden", {
        RAG_EVAL_OUT_DIR: OUT_DIR,
      });
      goldenRaw = readJsonSafe(path.join(OUT_DIR, "rag-golden-latest.json"));
      const g = goldenRaw as { summary?: { pass?: boolean }; frc?: { frc_mean?: number } } | null;
      res.summary = g?.summary?.pass
        ? `pass FRC=${g?.frc?.frc_mean ?? "—"}`
        : g
          ? `pass=${g.summary?.pass}`
          : "no report";
      stepResults.push(res);
      if (!res.ok && failFast) break;
      continue;
    }

    if (step === "frc") {
      const res = runNpmScript("frc", "rag:eval:frc", {
        RAG_EVAL_OUT_DIR: OUT_DIR,
        RAG_FRC_MODE: "golden-offline",
        RAG_FRC_LIMIT: "0",
      });
      frcRaw = readJsonSafe(path.join(OUT_DIR, "rag-frc-latest.json"));
      const f = frcRaw as {
        summary?: { pass?: boolean; frc_mean?: number };
        n?: number;
      } | null;
      res.summary = f
        ? `n=${f.n ?? "—"} FRC=${f.summary?.frc_mean ?? "—"} pass=${f.summary?.pass}`
        : "no report";
      stepResults.push(res);
      if (!res.ok && failFast) break;
      continue;
    }

    if (step === "compare") {
      const res = runNpmScript("compare", "rag:eval:compare", {
        RAG_EVAL_OUT_DIR: OUT_DIR,
        RAG_COMPARE_MODE: compareMode,
        RAG_COMPARE_LIMIT: compareLimit,
        RAG_COMPARE_ENABLE_GRAPH: process.env.RAG_COMPARE_ENABLE_GRAPH || "0",
        RAG_COMPARE_GENERATE: process.env.RAG_COMPARE_GENERATE || "0",
      });
      compareRaw = readJsonSafe(path.join(OUT_DIR, "rag-compare-latest.json"));
      const c = compareRaw as { mode?: string; summary?: unknown[] } | null;
      res.summary = c
        ? `${c.mode} strategies=${c.summary?.length ?? 0} limit=${compareLimit}`
        : "no report";
      stepResults.push(res);
      if (!res.ok && failFast) break;
    }
  }

  // Re-read latest if a step was skipped but artifacts exist
  if (!goldenRaw) goldenRaw = readJsonSafe(path.join(OUT_DIR, "rag-golden-latest.json"));
  if (!frcRaw) frcRaw = readJsonSafe(path.join(OUT_DIR, "rag-frc-latest.json"));
  if (!compareRaw) compareRaw = readJsonSafe(path.join(OUT_DIR, "rag-compare-latest.json"));

  const report = buildBenchmarkReport({
    dataset: {
      ready_count: cov.ready,
      target_total: ds.meta.target_total,
      version: ds.meta.version ?? null,
    },
    mode: {
      golden: process.env.GOLDEN_EVAL_MODE || "gold",
      frc: "golden-offline",
      compare: compareMode,
    },
    steps: stepResults,
    goldenRaw,
    frcRaw,
    compareRaw,
    notes: [
      `Golden ready=${cov.ready} planned=${cov.planned}（phase1=${cov.byPhase?.["1"] ?? "—"} phase2=${cov.byPhase?.["2"] ?? "—"} phase3=${cov.byPhase?.["3"] ?? "—"}）。`,
      "Golden／FRC 預設以 gold_answer 離線自洽，驗證標註與指標門檻。",
      compareMode === "fixture"
        ? "Compare 為 fixture：驗證策略展開與 Hit Rate 管線，非正式全量語料結果。"
        : "Compare 為 live：使用資料庫現行 Parent-Child 語料。",
      "四策略比較：Parent 預設關 Graph；Combined＝Parent＋GraphRAG。",
      "詳見 docs/RAG-BENCHMARK.md、docs/RAG-COMPARE.md、docs/RAG-FRC.md。",
    ],
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonText = JSON.stringify(report, null, 2);
  const mdText = formatBenchmarkMarkdown(report);
  writeFileSync(path.join(OUT_DIR, `rag-benchmark-${stamp}.json`), jsonText);
  writeFileSync(path.join(OUT_DIR, `rag-benchmark-${stamp}.md`), mdText);
  writeFileSync(path.join(OUT_DIR, "rag-benchmark-latest.json"), jsonText);
  writeFileSync(path.join(OUT_DIR, "rag-benchmark-latest.md"), mdText);

  console.log(jsonText);
  console.error(`Wrote ${path.join(OUT_DIR, "rag-benchmark-latest.md")}`);
  console.error(
    `benchmark pass=${report.pass} ready=${cov.ready} steps=${stepResults.map((s) => `${s.name}:${s.ok ? "ok" : "fail"}`).join(",")}`,
  );
  if (!report.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
