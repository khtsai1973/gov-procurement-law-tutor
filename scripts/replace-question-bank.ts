/**
 * 清空 QuestionBankItem 後自 data/question-bank/*.json 重匯。
 * 用法：DATABASE_URL=postgresql://… npx tsx scripts/replace-question-bank.ts
 */
import { PrismaClient } from "@prisma/client";

import { replaceQuestionBankFromDisk } from "../src/lib/import-question-bank";
import { clearQuestionBankCache } from "../src/lib/question-bank";
import { ingestCorpus } from "../src/lib/ingest";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.questionBankItem.count();
  console.log(`Before: ${before} question bank item(s)`);
  const result = await replaceQuestionBankFromDisk(prisma, "cli-replace");
  clearQuestionBankCache();
  console.log(
    `Replaced: deleted=${result.deleted}, imported=${result.imported}, files=${result.files}` +
      (result.synced ? `, categories=${result.synced.categories}` : ""),
  );
  const ingested = await ingestCorpus("cli-question-bank-replace");
  console.log(`Ingested question bank chunks: ${ingested.chunkTotal}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
