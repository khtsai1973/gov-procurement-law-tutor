const CHILD_MAX_CHARS = 480;
const CHILD_OVERLAP = 80;
const PARENT_MAX_CHARS = 4000;

/** 相容舊呼叫：扁平切塊上限 */
const MAX_CHARS = 1200;
const OVERLAP = 200;

const ARTICLE_HEADING = /^###\s*第\s*[\d\-]+\s*條/m;
const ARTICLE_KEY_RE = /###\s*(第\s*[\d\-]+\s*條)/;

export type ParentChildUnit = {
  /** 餵給模型的粗切片（完整條文／段落組） */
  parentContent: string;
  /** 條號鍵，如「第 48 條」 */
  articleKey: string | null;
  /** 向量搜尋用小切片（含 Contextual 前綴） */
  children: string[];
};

export type ParentChildPlan = {
  units: ParentChildUnit[];
};

function hardSplit(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];
  const parts: string[] = [];
  const step = Math.max(1, maxChars - overlap);
  for (let i = 0; i < text.length; i += step) {
    parts.push(text.slice(i, i + maxChars));
  }
  return parts;
}

function extractArticleKey(text: string): string | null {
  const m = text.match(ARTICLE_KEY_RE);
  if (!m?.[1]) return null;
  return m[1].replace(/\s+/g, " ").trim();
}

function titlePrefix(regulationTitle?: string): string {
  return regulationTitle ? `《${regulationTitle}》\n` : "";
}

/**
 * Contextual 前綴：寫入 CHILD 內容再做 embedding，提升小切片語意可辨識度。
 */
function contextualizeChild(
  childBody: string,
  regulationTitle: string | undefined,
  articleKey: string | null,
): string {
  const bits = ["【檢索單元】"];
  if (regulationTitle) bits.push(`法規：《${regulationTitle}》`);
  if (articleKey) bits.push(`條號：${articleKey}`);
  bits.push("角色：Child Chunk（精準搜尋）");
  return `${bits.join("｜")}\n${childBody}`;
}

function buildChildrenForParent(
  parentBody: string,
  regulationTitle: string | undefined,
  articleKey: string | null,
): string[] {
  const slices = hardSplit(parentBody, CHILD_MAX_CHARS, CHILD_OVERLAP);
  return slices.map((s) => contextualizeChild(s, regulationTitle, articleKey));
}

function splitArticleParts(normalized: string): string[] {
  return normalized.split(/(?=^###\s*第\s*[\d\-]+\s*條)/m);
}

/**
 * Parent-Document Chunking：
 * - Parent：以「### 第 N 條」為單位（或段落組），保留完整法條上下文給 LLM
 * - Child：較小視窗＋ Contextual 前綴，供向量／關鍵字搜尋
 */
export function chunkMarkdownParentChild(
  markdown: string,
  regulationTitle?: string,
): ParentChildPlan {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return { units: [] };

  const prefix = titlePrefix(regulationTitle);
  const units: ParentChildUnit[] = [];

  if (ARTICLE_HEADING.test(normalized) || splitArticleParts(normalized).length > 1) {
    for (const part of splitArticleParts(normalized)) {
      const p = part.trim();
      if (!p || p.length < 8) continue;
      const articleKey = extractArticleKey(p);
      const parentBody = (prefix + p).slice(0, PARENT_MAX_CHARS);
      units.push({
        parentContent: parentBody,
        articleKey,
        children: buildChildrenForParent(parentBody, regulationTitle, articleKey),
      });
    }
    if (units.length > 0) return { units };
  }

  // 無條號結構：以段落組為 Parent，再切 Child
  const flatParents = chunkMarkdown(normalized);
  for (const block of flatParents) {
    const parentBody = (prefix + block).slice(0, PARENT_MAX_CHARS);
    units.push({
      parentContent: parentBody,
      articleKey: null,
      children: buildChildrenForParent(parentBody, regulationTitle, null),
    });
  }
  return { units };
}

/**
 * RAG 用切塊（扁平，相容舊路徑）：優先以「### 第 N 條」為單位。
 * 新 ingest 請改用 chunkMarkdownParentChild。
 */
export function chunkMarkdownForRag(markdown: string, regulationTitle?: string): string[] {
  const plan = chunkMarkdownParentChild(markdown, regulationTitle);
  if (plan.units.length === 0) return [];
  // 扁平化時回傳 parent 內容，避免截斷法條
  return plan.units.map((u) => u.parentContent);
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
      for (const piece of hardSplit(p, MAX_CHARS, OVERLAP)) {
        chunks.push(piece);
      }
      continue;
    }
    buf = buf ? `${buf}\n\n${p}` : p;
  }
  flush();

  return chunks;
}

export const CHUNKING = {
  CHILD_MAX_CHARS,
  CHILD_OVERLAP,
  PARENT_MAX_CHARS,
} as const;
