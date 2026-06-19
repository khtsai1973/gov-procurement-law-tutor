import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";

import { questionBankFileSchema, type QuestionBankEntry } from "@/lib/question-bank-types";

const DATA_DIR = path.join(process.cwd(), "data", "question-bank");

function getQuestionBankItemDelegate(prisma: PrismaClient) {
  const delegate = prisma.questionBankItem;
  if (!delegate || typeof delegate.upsert !== "function") {
    throw new Error(
      "[question-bank] Prisma client missing `questionBankItem` delegate (model QuestionBankItem). " +
        "Run: npm run db:generate && npm run db:push",
    );
  }
  return delegate;
}

export async function loadQuestionBankEntriesFromDisk(): Promise<QuestionBankEntry[]> {
  let names: string[];
  try {
    names = await readdir(DATA_DIR);
  } catch {
    return [];
  }

  const jsonFiles = names.filter((n) => n.endsWith(".json")).sort();
  const byKey = new Map<string, QuestionBankEntry>();

  for (const file of jsonFiles) {
    const raw = await readFile(path.join(DATA_DIR, file), "utf8");
    const json = JSON.parse(raw) as unknown;
    const parsed = questionBankFileSchema.parse(json);
    if (parsed.items.length === 0) {
      console.warn(`[question-bank] Skipping ${file}: items array is empty`);
      continue;
    }
    for (const item of parsed.items) {
      byKey.set(item.key, item);
    }
  }

  return [...byKey.values()];
}

export async function importQuestionBank(
  prisma: PrismaClient,
  source = "import",
): Promise<{ imported: number; files: number }> {
  let fileCount = 0;
  try {
    const names = await readdir(DATA_DIR);
    fileCount = names.filter((n) => n.endsWith(".json")).length;
  } catch {
    fileCount = 0;
  }

  const entries = await loadQuestionBankEntriesFromDisk();
  if (entries.length === 0) {
    console.warn(`[question-bank] No JSON entries under ${DATA_DIR}`);
    return { imported: 0, files: fileCount };
  }

  const questionBankItem = getQuestionBankItemDelegate(prisma);

  const BATCH = 100;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((item) =>
        questionBankItem.upsert({
          where: { key: item.key },
          create: {
            key: item.key,
            question: item.question,
            keywords: item.keywords,
            relatedSlugs: item.relatedSlugs,
            hintAnswer: item.hintAnswer ?? null,
            category: item.category,
          },
          update: {
            question: item.question,
            keywords: item.keywords,
            relatedSlugs: item.relatedSlugs,
            hintAnswer: item.hintAnswer ?? null,
            category: item.category,
          },
        }),
      ),
    );
  }

  console.log(
    `[question-bank] ${source}: upserted ${entries.length} item(s) from ${fileCount} file(s)`,
  );
  return { imported: entries.length, files: fileCount };
}
