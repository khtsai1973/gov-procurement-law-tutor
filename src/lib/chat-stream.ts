/**
 * Chat SSE 串流：先推送狀態事件（降低體感等待），再分段推送答案。
 */

export type ChatStreamEvent =
  | { type: "status"; stage: "retrieve" | "generate" | "persist" }
  | { type: "delta"; text: string }
  | {
      type: "done";
      questionId: string | null;
      sources: { title: string; tier: string; slug: string }[];
      model: string;
      retrievalMode: string;
      warning?: string;
      defense?: string;
    }
  | { type: "error"; error: string };

export function encodeSse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** 將完整答案切成小段，供前端漸進顯示（答案已生成時） */
export function chunkTextForStream(text: string, size = 48): string[] {
  if (!text) return [];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.slice(i, i + size));
  }
  return parts;
}

export function createChatSseResponse(
  stream: ReadableStream<Uint8Array>,
): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
