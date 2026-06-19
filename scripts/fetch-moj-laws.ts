/**
 * 從全國法規資料庫 Open API 下載法規全文，寫入 data/corpus/<slug>.md
 * 用法：npm run corpus:fetch-moj
 */
import fs from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";

import { MOJ_API, MOJ_LAW_SOURCES, type MojLawSource } from "./moj-law-sources";

const ROOT = process.cwd();
const CORPUS_DIR = path.join(ROOT, "data", "corpus");
const CACHE_DIR = path.join(ROOT, "data", "moj-cache");
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type MojArticle = {
  ArticleType?: string;
  ArticleNo?: string;
  ArticleContent?: string;
};

type MojLaw = {
  LawName?: string;
  LawURL?: string;
  LawForeword?: string;
  LawModifiedDate?: string;
  LawEffectiveDate?: string;
  LawArticles?: MojArticle[];
};

type MojPayload = {
  UpdateDate?: string;
  Laws?: MojLaw[];
};

function pcodeFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/pcode=([^&]+)/i);
  return m?.[1] ?? null;
}

function buildFullText(law: MojLaw): string {
  const name = (law.LawName ?? "").trim();
  const lines: string[] = [name, ""];

  const foreword = (law.LawForeword ?? "").replace(/\r\n/g, "\n").trim();
  if (foreword) {
    lines.push(foreword, "");
  }

  for (const a of law.LawArticles ?? []) {
    const t = a.ArticleType ?? "";
    const no = (a.ArticleNo ?? "").trim();
    const c = (a.ArticleContent ?? "").replace(/\r\n/g, "\n").trim();
    if (!c) continue;
    if (t === "C") {
      lines.push(`## ${c}`);
    } else if (no) {
      lines.push(`### ${no}`, "", c, "");
    } else {
      lines.push(c, "");
    }
  }

  return lines.join("\n").trim();
}

function lawToMarkdown(law: MojLaw, source: MojLawSource): string {
  const url =
    law.LawURL ?? `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${source.pcode}`;
  const header = [
    `# ${law.LawName ?? source.title}`,
    "",
    `- 資料來源：[全國法規資料庫](${url})`,
    `- 法規代碼：${source.pcode}`,
    law.LawModifiedDate ? `- 修正日期：${law.LawModifiedDate}` : null,
    law.LawEffectiveDate ? `- 施行日期：${law.LawEffectiveDate}` : null,
    `- 自動下載時間：${new Date().toISOString().slice(0, 10)}`,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return `${header}\n${buildFullText(law)}\n`;
}

async function downloadMojPayload(docType: "law" | "order"): Promise<MojPayload> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `ch_${docType}.json`);
  const url = MOJ_API[docType];

  try {
    const stat = await fs.stat(cachePath);
    if (Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS) {
      console.log(`[cache] 使用快取 ${cachePath}`);
      const raw = await fs.readFile(cachePath, "utf8");
      return JSON.parse(raw) as MojPayload;
    }
  } catch {
    /* 無快取 */
  }

  console.log(`[download] ${url}`);
  const res = await fetch(url, {
    headers: { "User-Agent": "gov-procurement-law-tutor/1.0 (educational)" },
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    throw new Error(`MOJ API HTTP ${res.status}: ${url}`);
  }

  const zipBuf = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(zipBuf);
  const jsonEntry = zip
    .getEntries()
    .find((e) => e.entryName.toLowerCase().endsWith(".json") && !e.isDirectory);

  if (!jsonEntry) {
    throw new Error(`ZIP 內找不到 JSON：${docType}`);
  }

  const jsonText = zip.readAsText(jsonEntry, "utf8");
  await fs.writeFile(cachePath, jsonText, "utf8");
  console.log(`[cache] 已寫入 ${cachePath}`);

  return JSON.parse(jsonText) as MojPayload;
}

function indexByPcode(payload: MojPayload): Map<string, MojLaw> {
  const map = new Map<string, MojLaw>();
  for (const law of payload.Laws ?? []) {
    const code = pcodeFromUrl(law.LawURL);
    if (code) map.set(code.toUpperCase(), law);
  }
  return map;
}

async function main() {
  await fs.mkdir(CORPUS_DIR, { recursive: true });

  const [lawPayload, orderPayload] = await Promise.all([
    downloadMojPayload("law"),
    downloadMojPayload("order"),
  ]);

  const lawIndex = indexByPcode(lawPayload);
  const orderIndex = indexByPcode(orderPayload);

  let ok = 0;
  let miss = 0;

  for (const source of MOJ_LAW_SOURCES) {
    const law =
      (source.docType === "law" ? lawIndex : orderIndex).get(source.pcode.toUpperCase()) ??
      lawIndex.get(source.pcode.toUpperCase()) ??
      orderIndex.get(source.pcode.toUpperCase());

    if (!law) {
      console.warn(`[miss] 找不到 pcode=${source.pcode} (${source.title})`);
      miss++;
      continue;
    }

    const md = lawToMarkdown(law, source);
    const outPath = path.join(CORPUS_DIR, `${source.slug}.md`);
    await fs.writeFile(outPath, md, "utf8");
    console.log(`[ok] ${source.slug}.md (${md.length} chars)`);
    ok++;
  }

  console.log("");
  console.log(`完成：成功 ${ok}，失敗 ${miss}`);
  console.log("下一步：npm run corpus:ingest  （或 npm run corpus:refresh 一次完成）");

  const pccOnly = [
    "common-supply-contract-points",
    "public-works-public-inspection-points",
    "procurement-contract-essentials",
    "procurement-error-patterns",
    "mep-combined-separate-bidding",
    "international-competition-guidelines",
    "mega-procurement-reporting-rules",
    "turnkey-procurement-notice",
    "review-committee-panel-points",
    "expert-roster-db-points",
  ];
  console.log("");
  console.log("以下為工程會行政規則／要點，不在 MOJ API，請手動放置 Markdown：");
  for (const slug of pccOnly) console.log(`  - data/corpus/${slug}.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
