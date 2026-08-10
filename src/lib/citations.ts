/**
 * 可追溯引文：回答中的 [片段N] 對應檢索片段原文與版本資訊。
 */

export type CitationSource = {
  /** 1-based，對應 [片段N] */
  index: number;
  chunkId: string;
  title: string;
  tier: string;
  slug: string;
  articleKey: string | null;
  /** 原始條文／函釋摘錄 */
  content: string;
  /** 法規版本／異動日（ISO 或說明文字） */
  versionLabel: string | null;
  sourceUrl: string | null;
};

export function buildCitationSources(
  chunks: Array<{
    id: string;
    content: string;
    articleKey?: string | null;
    regulation: {
      title: string;
      tier: string;
      slug: string;
      lastModifiedAt?: Date | string | null;
      sourceUrl?: string | null;
      notes?: string | null;
    };
  }>,
): CitationSource[] {
  return chunks.map((c, i) => {
    const lm = c.regulation.lastModifiedAt
      ? typeof c.regulation.lastModifiedAt === "string"
        ? c.regulation.lastModifiedAt
        : c.regulation.lastModifiedAt.toISOString().slice(0, 10)
      : null;
    const versionLabel =
      lm || c.regulation.notes?.trim() || null;
    return {
      index: i + 1,
      chunkId: c.id,
      title: c.regulation.title,
      tier: c.regulation.tier,
      slug: c.regulation.slug,
      articleKey: c.articleKey ?? null,
      content: c.content,
      versionLabel,
      sourceUrl: c.regulation.sourceUrl ?? null,
    };
  });
}

const CITE_RE = /\[片段\s*(\d+)\s*\]/g;

export type AnswerSegment =
  | { kind: "text"; text: string }
  | { kind: "cite"; index: number };

/** 將答案拆成文字與引文標記，供 Popover 渲染 */
export function splitAnswerWithCitations(answer: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let last = 0;
  const re = new RegExp(CITE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer))) {
    if (m.index > last) {
      segments.push({ kind: "text", text: answer.slice(last, m.index) });
    }
    segments.push({ kind: "cite", index: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < answer.length) {
    segments.push({ kind: "text", text: answer.slice(last) });
  }
  return segments;
}
