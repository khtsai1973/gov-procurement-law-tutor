/**
 * Extract 政府採購法規全部題庫.pdf → data/question-bank/gpa-full-question-bank.json
 *
 * Usage:
 *   npm run corpus:parse-question-bank-pdf
 *   npm run corpus:parse-question-bank-pdf -- --pdf path/to/file.pdf
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  normalizePdfText,
  parseQuestionBankText,
  rawToEntries,
} from "./lib/parse-question-bank-text";
import { resolveQuestionBankPdfPath } from "./lib/resolve-question-bank-pdf";

const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, "data", "question-bank", "gpa-full-question-bank.json");
const LOG_PATH = path.join(ROOT, "data", "question-bank", "_parse-pdf-log.txt");
const TEXT_SAMPLE_PATH = path.join(ROOT, "data", "question-bank", "_parse-pdf-text-sample.txt");

async function parseArgs(): Promise<{ pdfPath: string }> {
  const idx = process.argv.indexOf("--pdf");
  const explicit = idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1]! : undefined;
  const pdfPath = await resolveQuestionBankPdfPath(ROOT, explicit);
  return { pdfPath };
}

async function extractPdfText(pdfPath: string): Promise<{ text: string; method: string }> {
  const buf = await readFile(pdfPath);

  try {
    const pdfParse = (await import("pdf-parse")).default as (
      data: Buffer,
    ) => Promise<{ text: string }>;
    const result = await pdfParse(buf);
    if ((result.text ?? "").trim().length >= 200) {
      return { text: result.text ?? "", method: "pdf-parse" };
    }
  } catch {
    /* try utf-8 fallback below */
  }

  const asText = buf.toString("utf8");
  if (/資料產生日期|選擇題|是非題/.test(asText) && asText.length >= 200) {
    return { text: asText, method: "utf8-fallback" };
  }

  throw new Error(
    "Could not extract text (pdf-parse empty and file is not UTF-8 text). " +
      "Run locally: pdftotext -enc UTF-8 政府採購法規全部題庫.pdf data/question-bank/gpa-full.txt " +
      "then: npx tsx scripts/parse-question-bank-from-text.ts --text data/question-bank/gpa-full.txt",
  );
}

async function main() {
  const { pdfPath } = await parseArgs();
  const log: string[] = [`pdf=${pdfPath}`, `started=${new Date().toISOString()}`];

  let statSize = 0;
  try {
    const { stat } = await import("node:fs/promises").then((fs) =>
      fs.stat(pdfPath).then((stat) => ({ stat })),
    );
    statSize = stat.size;
    log.push(`size_bytes=${statSize}`);
  } catch {
    const err = `PDF not found: ${pdfPath}`;
    log.push(err);
    await mkdir(path.dirname(OUT_JSON), { recursive: true });
    await writeFile(LOG_PATH, log.join("\n"), "utf8");
    console.error(err);
    process.exit(1);
  }

  const { text: rawText, method } = await extractPdfText(pdfPath);
  log.push(`extract_method=${method}`);
  log.push(`raw_chars=${rawText.length}`);

  const normalized = normalizePdfText(rawText);
  if (normalized.length < 200) {
    const err =
      "Extracted text too short — PDF may be scanned images. Run OCR locally or use pdftotext with a text-based export.";
    log.push(`error=${err}`);
    await mkdir(path.dirname(OUT_JSON), { recursive: true });
    await writeFile(LOG_PATH, log.join("\n"), "utf8");
    console.error(err);
    process.exit(2);
  }

  const rawItems = parseQuestionBankText(normalized);
  const items = rawToEntries(rawItems);
  log.push(`parsed_raw=${rawItems.length}`);
  log.push(`entries=${items.length}`);

  if (rawItems.length === 0) {
    const sample = normalized.slice(0, 2000);
    log.push(`debug_text_sample_chars=${sample.length}`);
    await writeFile(TEXT_SAMPLE_PATH, sample, "utf8");
    console.warn(
      `[parse-question-bank-pdf] parsedQuestions=0; first 2000 chars written to ${TEXT_SAMPLE_PATH}`,
    );
  }

  const withAnswer = items.filter((i) => i.hintAnswer).length;
  log.push(`with_hint_answer=${withAnswer}`);

  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  const payload = {
    version: 1,
    source: path.basename(pdfPath),
    parsedAt: new Date().toISOString(),
    extractMethod: method,
    itemCount: items.length,
    items,
  };
  await writeFile(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(LOG_PATH, log.join("\n"), "utf8");

  console.log(
    JSON.stringify({
      ok: true,
      pdfPath,
      sizeBytes: statSize,
      method,
      rawChars: rawText.length,
      parsedQuestions: rawItems.length,
      entries: items.length,
      withHintAnswer: withAnswer,
      outFile: OUT_JSON,
    }),
  );
}

main().catch(async (e) => {
  const msg = e instanceof Error ? e.stack ?? e.message : String(e);
  try {
    await mkdir(path.dirname(LOG_PATH), { recursive: true });
    await writeFile(LOG_PATH, `fatal\n${msg}\n`, "utf8");
  } catch {
    /* ignore */
  }
  console.error(msg);
  process.exit(1);
});
