import type { ChatCitation } from "@/lib/chat-types";
import type { ChunkWithReg } from "@/lib/rag";

const CONTENT_STORE_MAX = 12_000;

function extractArticleLabel(content: string): string | null {
  return content.match(/^###\s*(第[\d\-]+\s*條)/m)?.[1] ?? null;
}

/** 將 RAG 片段轉成前端可點擊的引用卡片資料（index 與 formatRagContext 一致） */
export function buildChatCitations(chunks: ChunkWithReg[]): ChatCitation[] {
  return chunks.map((c, i) => ({
    index: i + 1,
    chunkId: c.id,
    title: c.regulation.title,
    tier: String(c.regulation.tier),
    slug: c.regulation.slug,
    articleLabel: extractArticleLabel(c.content),
    content:
      c.content.length > CONTENT_STORE_MAX
        ? `${c.content.slice(0, CONTENT_STORE_MAX)}\n…（內容過長，已截斷）`
        : c.content,
    sourceUrl: c.regulation.sourceUrl,
  }));
}

export function parseCitationsJson(raw: string | null | undefined): ChatCitation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const r = row as Record<string, unknown>;
        if (typeof r.index !== "number" || typeof r.chunkId !== "string") {
          // 相容舊格式：僅 title/tier/slug
          if (typeof r.title === "string" && typeof r.slug === "string") {
            return {
              index: typeof r.index === "number" ? r.index : 0,
              chunkId: typeof r.chunkId === "string" ? r.chunkId : r.slug,
              title: r.title,
              tier: typeof r.tier === "string" ? r.tier : "",
              slug: r.slug,
              articleLabel: null,
              content: typeof r.content === "string" ? r.content : "",
              sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : null,
            } satisfies ChatCitation;
          }
          return null;
        }
        return {
          index: r.index,
          chunkId: r.chunkId,
          title: typeof r.title === "string" ? r.title : "",
          tier: typeof r.tier === "string" ? r.tier : "",
          slug: typeof r.slug === "string" ? r.slug : "",
          articleLabel: typeof r.articleLabel === "string" ? r.articleLabel : null,
          content: typeof r.content === "string" ? r.content : "",
          sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : null,
        } satisfies ChatCitation;
      })
      .filter((c): c is ChatCitation => c !== null);
  } catch {
    return [];
  }
}
