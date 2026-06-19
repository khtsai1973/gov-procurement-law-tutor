/**
 * 下載並產生《政府採購法》《政府採購法施行細則》完整 Markdown
 * 用法：node scripts/build-core-laws.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CORPUS = path.join(ROOT, "data", "corpus");
const CACHE = path.join(ROOT, "data", "moj-cache");
const GITHUB =
  "https://raw.githubusercontent.com/kong0107/mojLawSplitJSON/gh-pages/FalVMingLing";

const LAWS = [
  { pcode: "A0030057", slug: "government-procurement-act", title: "政府採購法" },
  { pcode: "A0030058", slug: "gpa-enforcement-rules", title: "政府採購法施行細則" },
];

function splitJsonToMarkdown(json, pcode, title) {
  const url =
    json.法規網址 ?? `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${pcode}`;
  const header = [
    `# ${json.法規名稱 ?? title}`,
    "",
    `- 資料來源：[全國法規資料庫](${url})`,
    `- 法規代碼：${pcode}`,
    json.最新異動日期 ? `- 修正日期：${json.最新異動日期}` : null,
    `- 自動下載時間：${new Date().toISOString().slice(0, 10)}`,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const body = [];
  const history = (json.沿革內容 ?? "").replace(/\r\n/g, "\n").trim();
  if (history) body.push("## 沿革", "", history, "");

  for (const item of json.法規內容 ?? []) {
    if (item.編章節) {
      body.push(`## ${item.編章節}`, "");
      continue;
    }
    if (item.條號) {
      const c = (item.條文內容 ?? "").replace(/\r\n/g, "\n").trim();
      body.push(`### ${item.條號}`, "", c, "");
    }
  }

  return `${header}\n${body.join("\n").trim()}\n`;
}

const AGENT_TOOL_FILES = {
  A0030057: "aea9b79d-7132-4db9-a3f8-6c7484b9b217.txt",
  A0030058: "c07983de-cfc4-4410-9b76-09f3723db520.txt",
};

function loadFromAgentTools(pcode) {
  const name = AGENT_TOOL_FILES[pcode];
  if (!name) return null;
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const agentPath = path.join(
    home,
    ".cursor",
    "projects",
    "empty-window",
    "agent-tools",
    name,
  );
  if (!fs.existsSync(agentPath)) return null;
  console.log(`[agent-tools] ${agentPath}`);
  return JSON.parse(fs.readFileSync(agentPath, "utf8"));
}

async function loadJson(pcode) {
  const cachePath = path.join(CACHE, `${pcode}.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  const fromAgent = loadFromAgentTools(pcode);
  if (fromAgent) {
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(fromAgent, null, 2), "utf8");
    return fromAgent;
  }
  const url = `${GITHUB}/${pcode}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "gov-procurement-law-tutor/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const json = await res.json();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(json, null, 2), "utf8");
  return json;
}

async function main() {
  fs.mkdirSync(CORPUS, { recursive: true });
  for (const law of LAWS) {
    const json = await loadJson(law.pcode);
    const md = splitJsonToMarkdown(json, law.pcode, law.title);
    const out = path.join(CORPUS, `${law.slug}.md`);
    fs.writeFileSync(out, md, "utf8");
    const articles = (json.法規內容 ?? []).filter((x) => x.條號).length;
    const yiJia = (md.match(/議價/g) ?? []).length;
    console.log(`[ok] ${law.slug}.md — ${articles} 條, ${md.length} 字, 「議價」${yiJia} 處`);
  }
  console.log("\n下一步：npm run corpus:ingest");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
