import { PrismaClient } from "@prisma/client";

import { ingestRegulationSlugs } from "../src/lib/ingest";
import { importNotebookLmSources, NOTEBOOKLM_DIR } from "../src/lib/notebooklm-import";

const prisma = new PrismaClient();

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readOption(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const dryRun = readFlag("--dry-run");
  const noIngest = readFlag("--no-ingest");
  const dir = readOption("--dir") ?? NOTEBOOKLM_DIR;
  const notebookTitle = readOption("--notebook");
  const notebookUrl = readOption("--notebook-url");

  console.log(`[notebooklm] 匯入目錄：${dir}`);
  if (dryRun) console.log("[notebooklm] dry-run 模式：不寫入資料庫與 corpus");

  const result = await importNotebookLmSources(prisma, {
    dir,
    dryRun,
    notebookTitle,
    notebookUrl,
  });

  if (result.skipped.length > 0) {
    console.warn("[notebooklm] 略過：", result.skipped.join(", "));
  }

  if (result.imported === 0) {
    console.warn(
      "[notebooklm] 沒有可匯入的檔案。請將 NotebookLM 匯出的 .md / .txt 放入 data/notebooklm/，或建立 manifest.json",
    );
    return;
  }

  console.log(
    `[notebooklm] ${dryRun ? "將匯入" : "已匯入"} ${result.imported} 份來源：`,
    result.slugs.join(", "),
  );

  if (dryRun || noIngest || result.slugs.length === 0) return;

  const ingested = await ingestRegulationSlugs(result.slugs, "cli-notebooklm");
  console.log(
    `[notebooklm] RAG ingest 完成：regulations=${ingested.regulationCount}, chunks=${ingested.chunkTotal}, embeddings=${ingested.embeddedTotal}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
