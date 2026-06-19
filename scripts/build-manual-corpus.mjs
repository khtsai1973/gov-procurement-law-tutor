/**
 * Convert PCC PDF text extract → data/corpus/most-advantageous-tender-operations-manual.md
 * Usage: node scripts/build-manual-corpus.mjs [path-to-extract.txt]
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_IN = path.join(ROOT, "data", "moj-cache", "manual-pdf-extract.txt");
const OUT = path.join(ROOT, "data", "corpus", "most-advantageous-tender-operations-manual.md");

const MAJOR = /^(壹|貳|參|肆|伍|陸|柒|捌|玖|拾)、/;
const MAJOR_ALT =
  /^(最有利標錯誤行為態樣|採購評選程序精進措施|採購評選作業檢核表|附錄|附錄一|附錄二)/;
const MINOR = /^[一二三四五六七八九十]+、/;
const SUB = /^[（(][一二三四五六七八九十]+[）)]/;
const TOC = /\.{3,}\s*\d/;
const PAGE_ONLY = /^\d+$/;

function normalize(s) {
  return s.replace(/\uF06C/g, "利").replace(/\uF0E8/g, "神").trim();
}

function isHeadingLine(line) {
  const t = normalize(line);
  if (!t || TOC.test(t) || PAGE_ONLY.test(t)) return false;
  if (t === "最有利標作業手冊" || t.startsWith("109.") || t.startsWith("113.")) return false;
  return MAJOR.test(t) || MAJOR_ALT.test(t) || MINOR.test(t) || SUB.test(t);
}

function headingLevel(line) {
  const t = normalize(line);
  if (MAJOR.test(t) || MAJOR_ALT.test(t)) return 2;
  if (MINOR.test(t)) return 3;
  if (SUB.test(t)) return 4;
  return 0;
}

async function main() {
  const inPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_IN;
  const raw = await fs.readFile(inPath, "utf8");
  const lines = raw.split(/\r?\n/);

  const header = `# 最有利標作業手冊

- 資料來源：[工程會－採購手冊及範例](https://www.pcc.gov.tw/content/list?eid=4581)
- PDF 下載（109.11.10 版文字擷取）：https://www.pcc.gov.tw/DL.aspx?icon=.pdf&n=5pyA5pyJ5Yip5qiZ5L2c5qWt5omL5YaKLTEwOTExMTAucGRm&nodeid=2767&sitessn=297&u=LzAwMS9VcGxvYWQvMjk3L3JlbGZpbGUvNzY5My8xOTY1LzkzYmZhYzg5LTY0ZTgtNDk5Yy1iOTIxLWM3OTk0ZmYwYjY5Mi5wZGY%3D
- 113.12.16 修正說明：[工程企字第1130100580號](https://planpe.pcc.gov.tw/prms/explainLetter/readPrmsExplainLetterContentDetail?pkPrmsRuleContent=75003140)
- 匯入時間：${new Date().toISOString().slice(0, 10)}
- 備註：本文自工程會 PDF 自動轉檔（109.11.10 版）。113.12.16 修正重點見文末「113 年修正摘要」；「快速使用指引」等 113 版新增章節請以工程會最新 PDF 為準。附錄評選配分範例表多為連結至 PCC 網站，未全文收錄。

## 113 年修正摘要（113.12.16 工程企字第1130100580號）

- 增訂「最有利標作業手冊快速使用指引」及「常用程序及問題快速索引」。
- 評定最有利標為機關內部審標；決標前須首長或授權人員核定（貳、一、(八)）。
- 專業／技術／資訊／社福服務以不訂底價為原則（貳、二、甲、(七)）。
- 準用最有利標議價主持人須經首長或授權人核定指派（貳、二、乙、(八)）。
- 固定價格下廠商報價低於固定價格視為自願減價（參、一、(三)）。
- 評選同分／同商數／同序位處理方式應載明於招標文件（參、四、附註）。
- 召集人由首長或一級主管以上擔任；不得遴選情形及名單查核（肆、一）。
- 得納入「創意」評選，不得將「回饋」列為評選項目（肆、二）。
- 資格審查通知應教示救濟（肆、四）。
- 配合審議規則第14條之1：決標後委員不得擔任得標廠商履約成員（肆、五、(十七)）。
- 錯誤行為態樣、評選配分範例（CSR、資安等）同步修正。

`;

  const body = [];
  let buf = [];
  let currentLevel = 0;

  const flush = () => {
    if (buf.length === 0) return;
    const text = buf.map(normalize).join("\n").trim();
    if (text) body.push(text, "");
    buf = [];
  };

  let started = false;
  for (const line of lines) {
    const t = normalize(line);
    if (!started) {
      if (t.includes("最有利標作業手冊") && !TOC.test(t)) started = true;
      continue;
    }
    if (t.startsWith("附錄") && t.includes("評選項目及配分權重範例") && TOC.test(t)) continue;
    if (TOC.test(t) && t.length < 120) continue;
    if (PAGE_ONLY.test(t)) continue;

    const lvl = isHeadingLine(line) ? headingLevel(line) : 0;
    if (lvl > 0) {
      flush();
      const hashes = "#".repeat(lvl);
      body.push(`${hashes} ${t}`, "");
      currentLevel = lvl;
      continue;
    }
    if (!t) {
      flush();
      continue;
    }
    buf.push(t);
  }
  flush();

  const md = `${header}${body.join("\n").trim()}\n`;
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, md, "utf8");
  console.log(`Wrote ${OUT} (${md.length} bytes, ${body.length} blocks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
