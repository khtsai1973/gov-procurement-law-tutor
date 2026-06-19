import fs from "node:fs/promises";
import path from "node:path";

import { canUseEmbeddings, embedTexts } from "@/lib/embeddings";
import { chunkMarkdownForRag } from "@/lib/chunk-text";
import { prisma } from "@/lib/prisma";

const CORPUS_DIR = path.join(process.cwd(), "data", "corpus");
const EMBED_BATCH = 40;

const STUB_TEMPLATE = (title: string) =>
  `（此為占位內容，請將《${title}》全文匯入 data/corpus/${title}.md 對應之 slug 檔。）\n\n` +
  `本站回答僅引用已匯入之條文與函釋摘錄。`;

function embeddingSchemaMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Unknown argument `embedding`") || msg.includes("no such column: embedding");
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

export async function ingestCorpus(triggeredBy: string) {
  const regulations = await prisma.regulation.findMany({ orderBy: { slug: "asc" } });
  let chunkTotal = 0;
  let embeddedTotal = 0;

  for (const reg of regulations) {
    const filePath = path.join(CORPUS_DIR, `${reg.slug}.md`);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch {
      raw = STUB_TEMPLATE(reg.title);
    }

    const chunks = chunkMarkdownForRag(raw, reg.title);
    await prisma.docChunk.deleteMany({ where: { regulationId: reg.id } });

    if (chunks.length === 0) continue;

    const created = await prisma.docChunk.createManyAndReturn({
      data: chunks.map((content, chunkIndex) => ({
        regulationId: reg.id,
        content,
        chunkIndex,
      })),
    });

    chunkTotal += created.length;
    embeddedTotal += await attachEmbeddings(
      created.map((c) => c.id),
      created.map((c) => c.content),
    );
  }

  const embedNote = canUseEmbeddings()
    ? `, embeddings=${embeddedTotal}`
    : ", embeddings=skipped(no OPENAI_API_KEY)";

  await prisma.knowledgeSync.create({
    data: {
      triggeredBy,
      status: "ok",
      message: `ingested chunks=${chunkTotal}, regulations=${regulations.length}${embedNote}`,
    },
  });

  return { chunkTotal, regulationCount: regulations.length, embeddedTotal };
}
