/**
 * Stage PDF extract (if needed) + build operations manual corpus + refresh selection rules.
 * Usage: node scripts/import-mat-manual.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOG = path.join(ROOT, "data", "moj-cache", "_import-mat-log.txt");
const CACHE_EXTRACT = path.join(ROOT, "data", "moj-cache", "manual-pdf-extract.txt");
const FALLBACK_EXTRACT =
  "C:/Users/sport/.cursor/projects/empty-window/agent-tools/dd0cebf6-7511-4da7-a9dc-7eff6c0d2e8f.txt";

const lines = [];
function log(s) {
  lines.push(s);
  console.log(s);
}

async function main() {
  await fs.mkdir(path.dirname(LOG), { recursive: true });
  await fs.mkdir(path.dirname(CACHE_EXTRACT), { recursive: true });

  try {
    await fs.access(CACHE_EXTRACT);
    log(`[ok] extract exists: ${CACHE_EXTRACT}`);
  } catch {
    try {
      const raw = await fs.readFile(FALLBACK_EXTRACT, "utf8");
      await fs.writeFile(CACHE_EXTRACT, raw, "utf8");
      log(`[ok] copied extract from ${FALLBACK_EXTRACT}`);
    } catch (e) {
      log(`[fail] no extract at ${CACHE_EXTRACT} or fallback: ${e}`);
      process.exit(1);
    }
  }

  const stat = await fs.stat(CACHE_EXTRACT);
  log(`[info] extract size ${stat.size} bytes`);

  log("[run] npx tsx scripts/fetch-moj-github.ts A0030080");
  const fetch = spawnSync("npx", ["tsx", "scripts/fetch-moj-github.ts", "A0030080"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  if (fetch.stdout) log(fetch.stdout.trimEnd());
  if (fetch.stderr) log(fetch.stderr.trimEnd());
  log(`[fetch] exit ${fetch.status ?? "?"}`);

  log("[run] node scripts/build-manual-corpus.mjs");
  const build = spawnSync("node", ["scripts/build-manual-corpus.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  if (build.stdout) log(build.stdout.trimEnd());
  if (build.stderr) log(build.stderr.trimEnd());
  log(`[build] exit ${build.status ?? "?"}`);

  const corpus = path.join(ROOT, "data", "corpus", "most-advantageous-tender-operations-manual.md");
  const rules = path.join(ROOT, "data", "corpus", "most-advantageous-tender-selection-rules.md");
  for (const f of [corpus, rules]) {
    const s = await fs.stat(f);
    const text = await fs.readFile(f, "utf8");
    const stub =
      text.includes("以下為章節大綱") ||
      text.includes("手動匯入步驟") ||
      text.includes("大綱＋匯入指引");
    log(`[out] ${path.basename(f)} ${s.size} bytes stub=${stub}`);
  }

  log("[run] npm run db:seed");
  const seed = spawnSync("npm", ["run", "db:seed"], { cwd: ROOT, encoding: "utf8", shell: true });
  if (seed.stdout) log(seed.stdout.trimEnd());
  if (seed.stderr) log(seed.stderr.trimEnd());
  log(`[seed] exit ${seed.status ?? "?"}`);

  log("[run] npm run corpus:ingest");
  const ingest = spawnSync("npm", ["run", "corpus:ingest"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  if (ingest.stdout) log(ingest.stdout.trimEnd());
  if (ingest.stderr) log(ingest.stderr.trimEnd());
  log(`[ingest] exit ${ingest.status ?? "?"}`);

  await fs.writeFile(LOG, lines.join("\n") + "\n", "utf8");
  log(`[done] log ${LOG}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
