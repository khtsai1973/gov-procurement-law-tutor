/**
 * 僅為尚未有 embedding 的片段建立語意向量（RAG 語意檢索用）
 * 用法：npm run corpus:embed
 */
import { canUseEmbeddings, embedTexts } from "../src/lib/embeddings";
import { prisma } from "../src/lib/prisma";

const BATCH = 40;

async function main() {
  if (!canUseEmbeddings()) {
    console.error("需要設定 OPENAI_API_KEY，且 OPENAI_DISABLED 不可為 true");
    process.exit(1);
  }

  const missing = await prisma.docChunk.findMany({
    where: { OR: [{ embedding: null }, { embedding: "" }] },
    select: { id: true, content: true },
  });

  if (missing.length === 0) {
    console.log("所有片段已有 embedding，無需處理。");
    return;
  }

  console.log(`待建立 embedding：${missing.length} 段`);

  let done = 0;
  for (let i = 0; i < missing.length; i += BATCH) {
    const slice = missing.slice(i, i + BATCH);
    const vectors = await embedTexts(slice.map((c) => c.content));
    await Promise.all(
      slice.map((c, j) =>
        prisma.docChunk.update({
          where: { id: c.id },
          data: { embedding: JSON.stringify(vectors[j]) },
        }),
      ),
    );
    done += slice.length;
    console.log(`  ${done}/${missing.length}`);
  }

  console.log("完成。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
