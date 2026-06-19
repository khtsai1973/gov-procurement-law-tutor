import { PrismaClient } from "@prisma/client";

import { clearQuestionBankCache } from "../src/lib/question-bank";
import { importQuestionBank } from "../src/lib/import-question-bank";

const prisma = new PrismaClient();

async function main() {
  const result = await importQuestionBank(prisma, "cli");
  clearQuestionBankCache();
  console.log(`Question bank: ${result.imported} item(s) from ${result.files} JSON file(s)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
