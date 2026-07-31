/** 問答 API／前端共用的 RAG 引用出處 */
export type ChatCitation = {
  /** 與提示詞【片段N】、回答 [片段N] 對應（1-based） */
  index: number;
  chunkId: string;
  title: string;
  tier: string;
  slug: string;
  articleLabel: string | null;
  /** 資料庫 DocChunk 原文切片 */
  content: string;
  sourceUrl: string | null;
};

export type ChatStreamMeta = {
  questionId: string;
  sources: ChatCitation[];
  retrievalMode: string;
  model?: string;
  warning?: string;
};
