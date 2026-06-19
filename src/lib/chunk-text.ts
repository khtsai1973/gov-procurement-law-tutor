const MAX_CHARS = 1200;
const OVERLAP = 200;

const ARTICLE_HEADING = /^###\s*第\s*[\d\-]+\s*條/m;

function hardSplit(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += MAX_CHARS - OVERLAP) {
    parts.push(text.slice(i, i + MAX_CHARS));
  }
  return parts;
}

/**
 * RAG 用切塊：優先以「### 第 N 條」為單位，並加上法規名稱前綴以利檢索與引用。
 */
export function chunkMarkdownForRag(markdown: string, regulationTitle?: string): string[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const prefix = regulationTitle ? `《${regulationTitle}》\n` : "";
  const parts = normalized.split(/(?=^###\s*第\s*[\d\-]+\s*條)/m);
  const chunks: string[] = [];

  if (parts.length > 1 || ARTICLE_HEADING.test(normalized)) {
    for (const part of parts) {
      const p = part.trim();
      if (!p || p.length < 8) continue;
      for (const piece of hardSplit(p)) {
        chunks.push(prefix + piece);
      }
    }
    if (chunks.length > 0) return chunks;
  }

  return chunkMarkdown(markdown).map((c) => prefix + c);
}

/** 將長文切成可檢索片段（以段落為主，過長則硬切並保留重疊） */
export function chunkMarkdown(markdown: string): string[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };

  for (const p of paragraphs) {
    if ((buf.length ? buf.length + 2 : 0) + p.length > MAX_CHARS) {
      if (buf) flush();
      if (p.length <= MAX_CHARS) {
        buf = p;
        continue;
      }
      for (let i = 0; i < p.length; i += MAX_CHARS - OVERLAP) {
        chunks.push(p.slice(i, i + MAX_CHARS));
      }
      continue;
    }
    buf = buf ? `${buf}\n\n${p}` : p;
  }
  flush();

  return chunks;
}
