#!/usr/bin/env node
/**
 * Live RAG 評測一輪（串接 smoke / compare / FRC）。
 *
 * 用法：
 *   npm run rag:eval:live
 *
 *   # 排程預設：compare 檢索 + 離線 FRC（不需 OPENAI）
 *   npm run rag:eval:live
 *
 *   # 完整一輪（含 smoke live + FRC live，需 OPENAI_API_KEY）
 *   RAG_LIVE_SUITE_GENERATE=1 npm run rag:eval:live
 *
 * 環境：
 *   DATABASE_URL          必填（live 檢索）
 *   OPENAI_API_KEY        RAG_LIVE_SUITE_GENERATE=1 時必填
 *   RAG_LIVE_SUITE_STEPS  逗號分隔：eval,compare,frc（預設全跑）
 *   RAG_LIVE_SUITE_COMPARE_LIMIT  預設 50
 *   RAG_FRC_LIMIT         live FRC 題數上限（預設 15）
 *   RAG_EVAL_OUT_DIR      預設 docs/evidence
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const OUT_DIR = process.env.RAG_EVAL_OUT_DIR || join(root, "docs", "evidence");
const GENERATE =
  process.env.RAG_LIVE_SUITE_GENERATE === "1" ||
  process.env.RAG_LIVE_SUITE_GENERATE === "true";
const DEFAULT_STEPS = GENERATE ? "eval,compare,frc" : "compare,frc";
const STEPS = (process.env.RAG_LIVE_SUITE_STEPS || DEFAULT_STEPS)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const COMPARE_LIMIT = process.env.RAG_LIVE_SUITE_COMPARE_LIMIT || "50";
const FRC_LIMIT = process.env.RAG_FRC_LIMIT || "15";
const FAIL_FAST =
  process.env.RAG_LIVE_SUITE_FAIL_FAST !== "0" &&
  process.env.RAG_LIVE_SUITE_FAIL_FAST !== "false";

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function runStep(name, cmd, args, extraEnv = {}) {
  console.error(`\n=== ${name} ===`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  const ok = r.status === 0;
  console.error(`${name}: exit=${r.status ?? "?"} ok=${ok}`);
  return { name, ok, exitCode: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function markdownReport(report) {
  const lines = [
    "# Live RAG 評測一輪（Suite）",
    "",
    `- 產生時間（UTC）：${report.generated_at}`,
    `- 步驟：${report.steps_requested.join(", ")}`,
    `- 生成模式（LLM）：${report.generate ? "是" : "否（僅檢索／離線 FRC）"}`,
    `- DATABASE_URL：${report.has_database ? "✓" : "✗"}`,
    `- OPENAI_API_KEY：${report.has_openai ? "✓" : "✗"}`,
    "",
    "## 步驟結果",
    "",
    "| 步驟 | 狀態 | 摘要 |",
    "| --- | --- | --- |",
  ];

  for (const s of report.step_results) {
    const status = s.ok ? "✅" : "❌";
    lines.push(`| \`${s.name}\` | ${status} | ${s.summary ?? "—"} |`);
  }

  lines.push("");
  lines.push("## 指標摘要");
  lines.push("");

  if (report.metrics.rag_eval) {
    const m = report.metrics.rag_eval;
    lines.push(
      `- **Smoke（cases.json live）**：F=${m.faithfulness_mean} R=${m.answer_relevance_mean} pass=${m.pass}`,
    );
  }
  if (report.metrics.rag_compare) {
    const m = report.metrics.rag_compare;
    for (const row of m.summary ?? []) {
      lines.push(
        `- **Compare \`${row.strategy}\`**：hit=${row.retrieval_hit_rate_mean} cite=${row.citation_accuracy_mean ?? "—"} p50=${row.latency?.p50}ms`,
      );
    }
  }
  if (report.metrics.rag_frc) {
    const m = report.metrics.rag_frc;
    lines.push(
      `- **FRC（${m.mode ?? "?"}）**：F=${m.faithfulness_mean} R=${m.relevance_mean} C=${m.citation_accuracy_mean ?? "—"} FRC=${m.frc_mean} pass=${m.pass}`,
    );
  }

  lines.push("");
  lines.push(`## 整體判定`);
  lines.push("");
  lines.push(
    report.pass
      ? "**通過**：所有已執行步驟均成功且指標達門檻。"
      : "**未通過**：至少一步失敗或未達門檻。",
  );
  lines.push("");
  lines.push("## 重跑");
  lines.push("");
  lines.push("```bash");
  lines.push("# 排程預設（檢索 + 離線 FRC，不呼叫 LLM 生成）");
  lines.push("npm run rag:eval:live");
  lines.push("");
  lines.push("# 完整 live（含 compare／FRC 生成）");
  lines.push("RAG_LIVE_SUITE_GENERATE=1 npm run rag:eval:live");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const hasDb = hasEnv("DATABASE_URL");
  const hasOpenai = hasEnv("OPENAI_API_KEY");

  console.error("RAG live suite");
  console.error(`  steps=${STEPS.join(",")} generate=${GENERATE} out=${OUT_DIR}`);

  if (!hasDb) {
    console.error("ERROR: DATABASE_URL 未設定，無法跑 live 評測。");
    process.exit(2);
  }
  if (GENERATE && !hasOpenai) {
    console.error("ERROR: RAG_LIVE_SUITE_GENERATE=1 需要 OPENAI_API_KEY。");
    process.exit(2);
  }

  const stepResults = [];
  let allPass = true;

  if (STEPS.includes("eval")) {
    if (!hasOpenai) {
      console.error("ERROR: 步驟 eval 需要 OPENAI_API_KEY（或改 RAG_LIVE_SUITE_STEPS=compare,frc）。");
      process.exit(2);
    }
    const r = runStep("rag-eval-live", "npm", ["run", "rag:eval"], {
      RAG_EVAL_MODE: "live",
      RAG_EVAL_OUT_DIR: OUT_DIR,
    });
    stepResults.push({
      ...r,
      summary: r.ok ? "smoke cases.json live" : "failed",
    });
    if (!r.ok) {
      allPass = false;
      if (FAIL_FAST) {
        /* continue to collect partial report */
      }
    }
  }

  if (STEPS.includes("compare")) {
    const compareEnv = {
      RAG_COMPARE_MODE: "live",
      RAG_COMPARE_LIMIT: COMPARE_LIMIT,
      RAG_COMPARE_ENABLE_GRAPH: "0",
      RAG_EVAL_OUT_DIR: OUT_DIR,
    };
    if (GENERATE) compareEnv.RAG_COMPARE_GENERATE = "1";

    const r = runStep("rag-compare-live", "npm", ["run", "rag:eval:compare"], compareEnv);
    stepResults.push({
      ...r,
      summary: r.ok
        ? `golden n=${COMPARE_LIMIT} generate=${GENERATE}`
        : "failed",
    });
    if (!r.ok) allPass = false;
  }

  if (STEPS.includes("frc")) {
    const frcEnv = {
      RAG_EVAL_OUT_DIR: OUT_DIR,
      RAG_FRC_LIMIT: FRC_LIMIT,
      RAG_FRC_MODE: GENERATE ? "live" : "golden-offline",
    };
    const r = runStep("rag-frc", "npm", ["run", "rag:eval:frc"], frcEnv);
    stepResults.push({
      ...r,
      summary: r.ok
        ? `mode=${frcEnv.RAG_FRC_MODE} limit=${FRC_LIMIT}`
        : "failed",
    });
    if (!r.ok) allPass = false;
  }

  const ragEval = readJsonSafe(join(OUT_DIR, "rag-eval-latest.json"));
  const ragCompare = readJsonSafe(join(OUT_DIR, "rag-compare-latest.json"));
  const ragFrc = readJsonSafe(join(OUT_DIR, "rag-frc-latest.json"));

  const metricsPass =
    (!ragEval?.summary || ragEval.summary.pass !== false) &&
    (!ragFrc?.summary || ragFrc.summary.pass !== false);

  const report = {
    generated_at: new Date().toISOString(),
    suite: "rag-live",
    steps_requested: STEPS,
    generate: GENERATE,
    has_database: hasDb,
    has_openai: hasOpenai,
    step_results: stepResults.map(({ name, ok, exitCode, summary }) => ({
      name,
      ok,
      exitCode,
      summary,
    })),
    metrics: {
      rag_eval: ragEval?.summary ?? null,
      rag_compare: ragCompare
        ? { mode: ragCompare.mode, summary: ragCompare.summary }
        : null,
      rag_frc: ragFrc?.summary
        ? { ...ragFrc.summary, mode: ragFrc.mode }
        : null,
    },
    pass: allPass && metricsPass,
    artifacts: {
      rag_eval: "rag-eval-latest.json",
      rag_compare: "rag-compare-latest.json",
      rag_frc: "rag-frc-latest.json",
    },
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(OUT_DIR, `rag-live-suite-${stamp}.json`);
  const mdPath = join(OUT_DIR, `rag-live-suite-${stamp}.md`);
  const latestJson = join(OUT_DIR, "rag-live-suite-latest.json");
  const latestMd = join(OUT_DIR, "rag-live-suite-latest.md");

  const jsonText = JSON.stringify(report, null, 2);
  const mdText = markdownReport(report);
  writeFileSync(jsonPath, jsonText);
  writeFileSync(mdPath, mdText);
  writeFileSync(latestJson, jsonText);
  writeFileSync(latestMd, mdText);

  console.log(jsonText);
  console.error(`Wrote ${mdPath}`);

  if (!report.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
