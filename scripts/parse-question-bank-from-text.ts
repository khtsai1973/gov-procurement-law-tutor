/**
 * Parse pre-extracted .txt (e.g. from pdftotext) → gpa-full-question-bank.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  normalizePdfText,
  parseQuestionBankText,
  rawToEntries,
} from "./lib/parse-question-bank-text";

const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, "data", "question-bank", "gpa-full-question-bank.json");

async function main() {
  const idx = process.argv.indexOf("--text");
  const textPath =
    idx >= 0 && process.argv[idx + 1]
      ? path.resolve(process.argv[idx + 1]!)
      : path.join(ROOT, "data", "question-bank", "gpa-full.txt");

  const raw = await readFile(textPath, "utf8");
  const normalized = normalizePdfText(raw);
  const rawItems = parseQuestionBankText(normalized);
  const items = rawToEntries(rawItems);

  if (rawItems.length === 0) {
    const samplePath = path.join(ROOT, "data", "question-bank", "_parse-text-sample.txt");
    await writeFile(samplePath, normalized.slice(0, 2000), "utf8");
    console.warn(
      `[parse-question-bank-from-text] parsedQuestions=0; first 2000 chars written to ${samplePath}`,
    );
  }

  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  await writeFile(
    OUT_JSON,
    `${JSON.stringify({ version: 1, source: path.basename(textPath), parsedAt: new Date().toISOString(), itemCount: items.length, items }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify({
      ok: true,
      textPath,
      parsedQuestions: rawItems.length,
      entries: items.length,
      outFile: OUT_JSON,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
