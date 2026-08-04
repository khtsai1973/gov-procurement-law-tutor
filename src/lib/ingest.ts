import fs from "node:fs/promises";
import path from "node:path";

import { RegulationTier } from "@prisma/client";

import { canUseEmbeddings, embedTexts } from "@/lib/embeddings";
import { chunkMarkdownParentChild } from "@/lib/chunk-text";
import { ensureDocChunkHierarchySchema } from "@/lib/ensure-doc-chunk-hierarchy-schema";
import { prisma } from "@/lib/prisma";
import { loadQuestionBankMarkdownForRegulation } from "@/lib/question-bank-corpus";

const CORPUS_DIR = path.join(process.cwd(), "data", "corpus");
const EMBED_BATCH = 40;

const STUB_TEMPLATE = (title: string) =>
  `（此為占位內容，請將《${title}》全文匯入 data/corpus/${title}.md 對應之 slug 檔。）\n\n` +
  `本站回答僅引用已匯入之條文與函釋摘錄。`;

function embeddingSchemaMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Unknown argument `embedding`") || msg.includes("no such column: embedding");
}

function hierarchySchemaMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Unknown argument `chunkRole`") ||
    msg.includes("Unknown argument `parentId`") ||
    msg.includes("Unknown argument `articleKey`") ||
    msg.includes("no such column: chunkRole") ||
    msg.includes("column \"chunkRole\"") ||
    msg.includes("column \"parentId\"")
  );
}

async function attachEmbeddings(chunkIds: string[], contents: string[]) {
  if (!canUseEmbeddings() || chunkIds.length === 0) return 0;

  let done = 0;
  let schemaWarned = false;

  for (let i = 0; i < contents.length; i += EMBED_BATCH) {
    const sliceContents = contents.slice(i, i + EMBED_BATCH);
    const sliceIds = chunkIds.slice(i, i + EMBED_BATCH);
    try {
      const vectors = await embedTexts(sliceContents);
      await Promise.all(
        sliceIds.map((id, j) =>
          prisma.docChunk.update({
            where: { id },
            data: { embedding: JSON.stringify(vectors[j]) },
          }),
        ),
      );
      done += sliceIds.length;
    } catch (e) {
      if (embeddingSchemaMissing(e)) {
        if (!schemaWarned) {
          console.warn(
            "[ingest] 資料庫尚無 embedding 欄位，已略過語意向量。請執行：npm run db:push && npm run db:generate && npm run corpus:ingest",
          );
          schemaWarned = true;
        }
        return done;
      }
      console.warn("[ingest] embedding batch failed:", e);
    }
  }
  return done;
}

async function ingestOneRegulation(
  reg: Awaited<ReturnType<typeof prisma.regulation.findMany>>[number],
): Promise<{ chunks: number; parents: number; children: number; embedded: number }> {
  const filePath = path.join(CORPUS_DIR, `${reg.slug}.md`);
  let raw: string;

  if (reg.tier === RegulationTier.QUESTION_BANK) {
    raw =
      (await loadQuestionBankMarkdownForRegulation(prisma, reg.slug, reg.title)) ??
      STUB_TEMPLATE(reg.title);
  } else {
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch {
      raw = STUB_TEMPLATE(reg.title);
    }
  }

  const plan = chunkMarkdownParentChild(raw, reg.title);
  // 先刪 CHILD 再刪 PARENT，避免自參照 FK 順序問題
  await prisma.docChunk.deleteMany({
    where: { regulationId: reg.id, chunkRole: "CHILD" },
  });
  await prisma.docChunk.deleteMany({ where: { regulationId: reg.id } });

  if (plan.units.length === 0) {
    return { chunks: 0, parents: 0, children: 0, embedded: 0 };
  }

  let chunkIndex = 0;
  let parentCount = 0;
  let childCount = 0;
  const childIds: string[] = [];
  const childContents: string[] = [];

  try {
    for (const unit of plan.units) {
      const parent = await prisma.docChunk.create({
        data: {
          regulationId: reg.id,
          content: unit.parentContent,
          chunkIndex: chunkIndex++,
          chunkRole: "PARENT",
          articleKey: unit.articleKey,
          embedding: null,
        },
      });
      parentCount += 1;

      for (const childContent of unit.children) {
        const child = await prisma.docChunk.create({
          data: {
            regulationId: reg.id,
            content: childContent,
            chunkIndex: chunkIndex++,
            chunkRole: "CHILD",
            parentId: parent.id,
            articleKey: unit.articleKey,
          },
        });
        childCount += 1;
        childIds.push(child.id);
        childContents.push(child.content);
      }
    }
  } catch (e) {
    if (hierarchySchemaMissing(e)) {
      console.warn(
        "[ingest] DocChunk 尚無 Parent-Child 欄位，請執行 ensureDocChunkHierarchySchema / db:push 後重試",
      );
      throw e;
    }
    throw e;
  }

  const embedded = await attachEmbeddings(childIds, childContents);

  return {
    chunks: parentCount + childCount,
    parents: parentCount,
    children: childCount,
    embedded,
  };
}

/** 僅重新 ingest 指定 slug（NotebookLM 匯入後常用） */
export async function ingestRegulationSlugs(slugs: string[], triggeredBy: string) {
  await ensureDocChunkHierarchySchema();
  const unique = [...new Set(slugs)];
  const regulations = await prisma.regulation.findMany({
    where: { slug: { in: unique } },
    orderBy: { slug: "asc" },
  });

  let chunkTotal = 0;
  let parentTotal = 0;
  let childTotal = 0;
  let embeddedTotal = 0;

  for (const reg of regulations) {
    const result = await ingestOneRegulation(reg);
    chunkTotal += result.chunks;
    parentTotal += result.parents;
    childTotal += result.children;
    embeddedTotal += result.embedded;
  }

  const embedNote = canUseEmbeddings()
    ? `, embeddings=${embeddedTotal}`
    : ", embeddings=skipped(no OPENAI_API_KEY)";

  await prisma.knowledgeSync.create({
    data: {
      triggeredBy,
      status: "ok",
      message: `ingested slugs=${unique.join(",")}, parents=${parentTotal}, children=${childTotal}, chunks=${chunkTotal}${embedNote}`,
    },
  });

  return {
    chunkTotal,
    parentTotal,
    childTotal,
    regulationCount: regulations.length,
    embeddedTotal,
    slugs: unique,
  };
}

export async function ingestCorpus(triggeredBy: string) {
  await ensureDocChunkHierarchySchema();
  const regulations = await prisma.regulation.findMany({ orderBy: { slug: "asc" } });
  let chunkTotal = 0;
  let parentTotal = 0;
  let childTotal = 0;
  let embeddedTotal = 0;

  for (const reg of regulations) {
    const result = await ingestOneRegulation(reg);
    chunkTotal += result.chunks;
    parentTotal += result.parents;
    childTotal += result.children;
    embeddedTotal += result.embedded;
  }

  const embedNote = canUseEmbeddings()
    ? `, embeddings=${embeddedTotal}`
    : ", embeddings=skipped(no OPENAI_API_KEY)";

  await prisma.knowledgeSync.create({
    data: {
      triggeredBy,
      status: "ok",
      message: `ingested parents=${parentTotal}, children=${childTotal}, chunks=${chunkTotal}, regulations=${regulations.length}${embedNote}`,
    },
  });

  return {
    chunkTotal,
    parentTotal,
    childTotal,
    regulationCount: regulations.length,
    embeddedTotal,
  };
}
