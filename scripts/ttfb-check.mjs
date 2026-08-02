#!/usr/bin/env node
/**
 * TTFB 量測與證據產出。
 *
 * 用法：
 *   node scripts/ttfb-check.mjs
 *   BASE_URL=https://gov-procurement-law-tutor.vercel.app node scripts/ttfb-check.mjs
 *
 * 評估對象：暖機後（warm）匿名公開頁 `/` 與 `/register` 的 TTFB。
 * 冷啟動（cold）可能因 serverless／Neon 休眠超過 0.5s，不列入合格判定，但仍寫入報告。
 *
 * 門檻：暖機後各路徑 p95 TTFB < 0.5s（預設；可用 THRESHOLD_MS 覆寫）
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const BASE_URL = (process.env.BASE_URL || "https://gov-procurement-law-tutor.vercel.app").replace(
  /\/$/,
  "",
);
const PATHS = (process.env.TTFB_PATHS || "/,/register").split(",").map((p) => p.trim()).filter(Boolean);
const WARM_N = Math.max(5, Number(process.env.TTFB_WARM_N || 20));
const THRESHOLD_MS = Number(process.env.THRESHOLD_MS || 500);
const OUT_DIR = process.env.TTFB_OUT_DIR || join(root, "docs", "evidence");

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

function stats(samplesMs) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    min_ms: sorted[0] ?? null,
    max_ms: sorted[sorted.length - 1] ?? null,
    mean_ms: sorted.length ? Math.round((sum / sorted.length) * 10) / 10 : null,
    p50_ms: percentile(sorted, 50),
    p95_ms: percentile(sorted, 95),
  };
}

/** 使用 curl 的 time_starttransfer 作為 TTFB（秒 → ms） */
async function measureOnce(url) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    "curl",
    [
      "-sS",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code} %{time_starttransfer} %{time_total}",
      "-H",
      "Cache-Control: no-cache",
      "-H",
      "Pragma: no-cache",
      url,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(`curl failed for ${url}: ${r.stderr || r.error}`);
  }
  const parts = String(r.stdout).trim().split(/\s+/);
  const httpCode = Number(parts[0]);
  const ttfbSec = Number(parts[1]);
  const totalSec = Number(parts[2]);
  return {
    http_code: httpCode,
    ttfb_ms: Math.round(ttfbSec * 1000 * 10) / 10,
    total_ms: Math.round(totalSec * 1000 * 10) / 10,
  };
}

async function warmup(base) {
  const health = `${base}/api/health`;
  const home = `${base}/`;
  // 兩次暖機：health + 首頁，降低 serverless 冷啟動影響
  for (const url of [health, home, health]) {
    try {
      await measureOnce(url);
    } catch {
      /* ignore warmup errors */
    }
  }
}

async function samplePath(base, path, n) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const samples = [];
  for (let i = 0; i < n; i++) {
    const m = await measureOnce(url);
    samples.push(m);
  }
  return { url, samples };
}

function markdownReport(report) {
  const lines = [
    `# TTFB 證據報告`,
    ``,
    `- 產生時間（UTC）：${report.generated_at}`,
    `- 目標站台：\`${report.base_url}\``,
    `- 門檻：暖機後 p95 < **${report.threshold_ms} ms**`,
    `- 暖機樣本數（每路徑）：${report.warm_n}`,
    `- 判定範圍：匿名公開頁暖機態（steady-state）；冷啟動僅供參考`,
    ``,
    `## 結果摘要`,
    ``,
    `| 路徑 | 冷啟動 TTFB (ms) | warm p50 | warm p95 | warm max | HTTP | 合格 |`,
    `| --- | ---: | ---: | ---: | ---: | ---: | --- |`,
  ];

  for (const row of report.paths) {
    const cold = row.cold?.ttfb_ms ?? "—";
    const ok = row.pass ? "✅" : "❌";
    lines.push(
      `| \`${row.path}\` | ${cold} | ${row.warm.p50_ms} | ${row.warm.p95_ms} | ${row.warm.max_ms} | ${row.http_ok ? "ok" : "fail"} | ${ok} |`,
    );
  }

  lines.push(``);
  lines.push(`## 整體判定`);
  lines.push(``);
  lines.push(report.pass ? `**通過**：所有評估路徑暖機 p95 < ${report.threshold_ms} ms。` : `**未通過**：至少一條路徑暖機 p95 ≥ ${report.threshold_ms} ms。`);
  lines.push(``);
  lines.push(`## 方法說明`);
  lines.push(``);
  lines.push(`1. \`GET /api/health\` 與首頁暖機 serverless。`);
  lines.push(`2. 各路徑先量測 1 次作為 cold 參考（若腳本啟動前已閒置）。`);
  lines.push(`3. 再連續量測 ${report.warm_n} 次，取 \`curl -w time_starttransfer\` 為 TTFB。`);
  lines.push(`4. 通過條件：各路徑 warm p95 < ${report.threshold_ms} ms，且樣本 HTTP 皆為 2xx/3xx。`);
  lines.push(``);
  lines.push(`重跑指令：`);
  lines.push(``);
  lines.push("```bash");
  lines.push(`BASE_URL=${report.base_url} npm run ttfb:check`);
  lines.push("```");
  lines.push(``);
  return lines.join("\n");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.error(`TTFB check → ${BASE_URL}`);
  console.error(`Warm samples/path: ${WARM_N}, threshold: ${THRESHOLD_MS}ms`);

  // Cold sample before warmup (best-effort; may already be warm)
  const coldByPath = {};
  for (const path of PATHS) {
    const url = `${BASE_URL}${path}`;
    try {
      coldByPath[path] = await measureOnce(url);
    } catch (e) {
      coldByPath[path] = { error: String(e) };
    }
  }

  await warmup(BASE_URL);

  const pathResults = [];
  let allPass = true;

  for (const path of PATHS) {
    const { url, samples } = await samplePath(BASE_URL, path, WARM_N);
    const ttfbs = samples.map((s) => s.ttfb_ms);
    const warm = stats(ttfbs);
    const httpOk = samples.every((s) => s.http_code >= 200 && s.http_code < 400);
    const pass = httpOk && warm.p95_ms != null && warm.p95_ms < THRESHOLD_MS;
    if (!pass) allPass = false;
    pathResults.push({
      path,
      url,
      cold: coldByPath[path],
      warm,
      http_ok: httpOk,
      pass,
      samples,
    });
    console.error(
      `${path}: warm p50=${warm.p50_ms}ms p95=${warm.p95_ms}ms pass=${pass}`,
    );
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report = {
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    threshold_ms: THRESHOLD_MS,
    warm_n: WARM_N,
    evaluation: "warm anonymous public pages (/ and /register)",
    pass: allPass,
    paths: pathResults.map(({ samples, ...rest }) => rest),
    raw_samples: Object.fromEntries(pathResults.map((r) => [r.path, r.samples])),
  };

  const jsonPath = join(OUT_DIR, `ttfb-${stamp}.json`);
  const mdPath = join(OUT_DIR, `ttfb-${stamp}.md`);
  const latestJson = join(OUT_DIR, "ttfb-latest.json");
  const latestMd = join(OUT_DIR, "ttfb-latest.md");

  const jsonText = JSON.stringify(report, null, 2);
  const mdText = markdownReport(report);
  writeFileSync(jsonPath, jsonText);
  writeFileSync(mdPath, mdText);
  writeFileSync(latestJson, jsonText);
  writeFileSync(latestMd, mdText);

  console.log(jsonText);
  console.error(`Wrote ${jsonPath}`);
  console.error(`Wrote ${mdPath}`);

  if (!allPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
