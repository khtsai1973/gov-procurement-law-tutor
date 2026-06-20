import { PrismaClient } from "@prisma/client";

import { ingestCorpus } from "../src/lib/ingest";
import { clearQuestionBankCache } from "../src/lib/question-bank";
import { importQuestionBank } from "../src/lib/import-question-bank";

const prisma = new PrismaClient();

async function main() {
  const result = await importQuestionBank(prisma, "cli");
  clearQuestionBankCache();
  console.log(`Question bank: ${result.imported} item(s) from ${result.files} JSON file(s)`);
  if (result.synced) {
    console.log(
      `Synced to regulations list: ${result.synced.categories} categories, ${result.synced.items} items`,
    );
  }
  const ingested = await ingestCorpus("cli-question-bank");
  console.log(`Ingested question bank chunks: ${ingested.chunkTotal}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
