/**
 * 從 mojLawSplitJSON（FalVMingLing）下載單一法規 JSON，轉為 data/corpus/<slug>.md
 * 當全國法規資料庫 ZIP API 無法使用時的備援。
 * 用法：npm run corpus:fetch-github
 */
import fs from "node:fs/promises";
import path from "node:path";

import { MOJ_LAW_SOURCES, type MojLawSource } from "./moj-law-sources";

const ROOT = process.cwd();
const CORPUS_DIR = path.join(ROOT, "data", "corpus");
const GITHUB_BASE =
  "https://raw.githubusercontent.com/kong0107/mojLawSplitJSON/gh-pages/FalVMingLing";

type SplitArticle = { 條號?: string; 條文內容?: string };
type SplitChapter = { 編章節?: string };
type SplitLawJson = {
  法規名稱?: string;
  法規網址?: string;
  最新異動日期?: string;
  沿革內容?: string;
  法規內容?: Array<SplitArticle | SplitChapter>;
};

export function splitJsonToMarkdown(json: SplitLawJson, source: MojLawSource): string {
  const url =
    json.法規網址 ?? `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${source.pcode}`;
  const header = [
    `# ${json.法規名稱 ?? source.title}`,
    "",
    `- 資料來源：[全國法規資料庫](${url})`,
    `- 法規代碼：${source.pcode}`,
    json.最新異動日期 ? `- 修正日期：${json.最新異動日期}` : null,
    `- 自動下載時間：${new Date().toISOString().slice(0, 10)}`,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const body: string[] = [];
  const history = (json.沿革內容 ?? "").replace(/\r\n/g, "\n").trim();
  if (history) {
    body.push("## 沿革", "", history, "");
  }

  for (const item of json.法規內容 ?? []) {
    if ("編章節" in item && item.編章節) {
      body.push(`## ${item.編章節}`, "");
      continue;
    }
    if ("條號" in item && item.條號) {
      const c = (item.條文內容 ?? "").replace(/\r\n/g, "\n").trim();
      body.push(`### ${item.條號}`, "", c, "");
    }
  }

  return `${header}\n${body.join("\n").trim()}\n`;
}

const CACHE_DIR = path.join(ROOT, "data", "moj-cache");

async function loadSplitJson(pcode: string): Promise<SplitLawJson> {
  const localPath = path.join(CACHE_DIR, `${pcode}.json`);
  try {
    const raw = await fs.readFile(localPath, "utf8");
    console.log(`[cache] ${localPath}`);
    return JSON.parse(raw) as SplitLawJson;
  } catch {
    /* fall through to GitHub */
  }

  const url = `${GITHUB_BASE}/${pcode}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "gov-procurement-law-tutor/1.0 (educational)" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`GitHub HTTP ${res.status}: ${url}`);
  }
  const json = (await res.json()) as SplitLawJson;
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(localPath, JSON.stringify(json, null, 2), "utf8");
  return json;
}

async function main() {
  const only = process.argv.slice(2);
  const sources =
    only.length > 0
      ? MOJ_LAW_SOURCES.filter((s) => only.includes(s.slug) || only.includes(s.pcode))
      : MOJ_LAW_SOURCES;

  if (sources.length === 0) {
    console.error("找不到指定的 slug 或 pcode");
    process.exit(1);
  }

  await fs.mkdir(CORPUS_DIR, { recursive: true });

  let ok = 0;
  let fail = 0;

  for (const source of sources) {
    try {
      const json = await loadSplitJson(source.pcode);
      const name = (json.法規名稱 ?? "").trim();
      if (name && name !== source.title) {
        console.warn(`[warn] ${source.slug}: 名稱不符（預期「${source.title}」，取得「${name}」）`);
      }
      const md = splitJsonToMarkdown(json, source);
      const outPath = path.join(CORPUS_DIR, `${source.slug}.md`);
      await fs.writeFile(outPath, md, "utf8");
      const articles = (json.法規內容 ?? []).filter((x) => "條號" in x).length;
      console.log(`[ok] ${source.slug}.md (${articles} 條, ${md.length} chars)`);
      ok++;
    } catch (e) {
      console.error(`[fail] ${source.title} (${source.pcode}):`, e);
      fail++;
    }
  }

  console.log("");
  console.log(`完成：成功 ${ok}，失敗 ${fail}`);
  console.log("下一步：npm run corpus:ingest");
  if (fail > 0) process.exit(1);
}

main();
