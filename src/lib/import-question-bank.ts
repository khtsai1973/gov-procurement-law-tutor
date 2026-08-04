import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { PrismaClient } from "@prisma/client";

import { resolveKnowledgeTags } from "@/lib/knowledge-tags";
import { questionBankFileSchema, type QuestionBankEntry } from "@/lib/question-bank-types";
import { syncQuestionBankRegulations } from "@/lib/question-bank-corpus";
import { coerceOfficialCategory } from "@/lib/question-bank-categories";

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
    names = [];
  }

  const jsonFiles = names
    .filter((n) => n.endsWith(".json"))
    // gpa-full 最後寫入，避免 starter 覆蓋正式題庫同 key
    .sort((a, b) => {
      const ag = a.includes("gpa-full") ? 1 : 0;
      const bg = b.includes("gpa-full") ? 1 : 0;
      return ag - bg || a.localeCompare(b);
    });
  const byKey = new Map<string, QuestionBankEntry>();

  for (const file of jsonFiles) {
    try {
      const raw = await readFile(path.join(DATA_DIR, file), "utf8");
      const json = JSON.parse(raw) as unknown;
      const parsed = questionBankFileSchema.parse(json);
      if (parsed.items.length === 0) {
        console.warn(`[question-bank] Skipping ${file}: items array is empty`);
        continue;
      }
      for (const item of parsed.items) {
        const category = coerceOfficialCategory(item.category);
        byKey.set(item.key, {
          ...item,
          category,
          knowledgeTags: resolveKnowledgeTags({ ...item, category }),
        });
      }
    } catch (e) {
      console.warn(`[question-bank] Failed reading ${file}:`, e);
    }
  }

  // Vercel 追蹤遺漏時的備援：打包內建 JSON
  if (byKey.size === 0) {
    try {
      const bundled = await import("../../data/question-bank/gpa-full-question-bank.json");
      const parsed = questionBankFileSchema.parse(bundled.default ?? bundled);
      for (const item of parsed.items) {
        const category = coerceOfficialCategory(item.category);
        byKey.set(item.key, {
          ...item,
          category,
          knowledgeTags: resolveKnowledgeTags({ ...item, category }),
        });
      }
      console.log(`[question-bank] loaded ${byKey.size} item(s) from bundled JSON fallback`);
    } catch (e) {
      console.warn("[question-bank] bundled JSON fallback failed:", e);
    }
  }

  return [...byKey.values()];
}

export async function importQuestionBank(
  prisma: PrismaClient,
  source = "import",
): Promise<{ imported: number; files: number; synced?: { categories: number; items: number; slugs: string[] } }> {
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
            knowledgeTags: item.knowledgeTags ?? resolveKnowledgeTags(item),
          },
          update: {
            question: item.question,
            keywords: item.keywords,
            relatedSlugs: item.relatedSlugs,
            hintAnswer: item.hintAnswer ?? null,
            category: item.category,
            knowledgeTags: item.knowledgeTags ?? resolveKnowledgeTags(item),
          },
        }),
      ),
    );
  }

  console.log(
    `[question-bank] ${source}: upserted ${entries.length} item(s) from ${fileCount} file(s)`,
  );

  const synced = await syncQuestionBankRegulations(prisma);
  console.log(
    `[question-bank] synced ${synced.categories} category/categories (${synced.items} items) to regulations list`,
  );

  return { imported: entries.length, files: fileCount, synced };
}

/** 清空題庫後自磁碟 JSON 全量重匯（用於分類結構變更） */
export async function replaceQuestionBankFromDisk(
  prisma: PrismaClient,
  source = "replace",
): Promise<{
  deleted: number;
  imported: number;
  files: number;
  synced?: { categories: number; items: number; slugs: string[] };
}> {
  let fileCount = 0;
  try {
    const names = await readdir(DATA_DIR);
    fileCount = names.filter((n) => n.endsWith(".json")).length;
  } catch {
    fileCount = 0;
  }

  const entries = await loadQuestionBankEntriesFromDisk();
  if (entries.length === 0) {
    throw new Error(`題庫 JSON 不存在或為空（目錄：${DATA_DIR}）`);
  }

  const questionBankItem = getQuestionBankItemDelegate(prisma);
  const deleted = await questionBankItem.deleteMany({});
  console.log(`[question-bank] ${source}: deleted ${deleted.count} old item(s)`);

  const BATCH = 200;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await questionBankItem.createMany({
      data: batch.map((item) => ({
        key: item.key,
        question: item.question,
        keywords: item.keywords,
        relatedSlugs: item.relatedSlugs,
        hintAnswer: item.hintAnswer ?? null,
        category: item.category,
        knowledgeTags: item.knowledgeTags ?? resolveKnowledgeTags(item),
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    `[question-bank] ${source}: created ${entries.length} item(s) from ${fileCount} file(s)`,
  );

  const synced = await syncQuestionBankRegulations(prisma);
  console.log(
    `[question-bank] synced ${synced.categories} category/categories (${synced.items} items) to regulations list`,
  );

  return {
    deleted: deleted.count,
    imported: entries.length,
    files: fileCount,
    synced,
  };
}
