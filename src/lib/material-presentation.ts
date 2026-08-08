/**
 * 將單元教材內容切成簡報投影片，並輸出 PPTX（PptxGenJS）。
 */

export type MaterialSlide = {
  title: string;
  bullets: string[];
  /** 非條列的段落文字 */
  paragraphs: string[];
};

export type MaterialPresentationInput = {
  title: string;
  category: string;
  unitCode?: string | null;
  summary?: string | null;
  content: string;
};

const MAX_BULLETS_PER_SLIDE = 8;
const MAX_CHARS_PER_BULLET = 160;

function stripMdInline(text: string): string {
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/^>\s?/gm, "")
    .trim();
}

function pushChunked(target: MaterialSlide[], title: string, lines: string[]) {
  const bullets: string[] = [];
  const paragraphs: string[] = [];
  for (const raw of lines) {
    const line = stripMdInline(raw);
    if (!line) continue;
    const bulletMatch = line.match(/^[-*+]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1]!.slice(0, MAX_CHARS_PER_BULLET));
    } else {
      paragraphs.push(line.slice(0, MAX_CHARS_PER_BULLET * 2));
    }
  }

  const items = [
    ...bullets.map((b) => ({ kind: "bullet" as const, text: b })),
    ...paragraphs.map((p) => ({ kind: "para" as const, text: p })),
  ];
  if (items.length === 0) {
    target.push({ title, bullets: [], paragraphs: [] });
    return;
  }

  for (let i = 0; i < items.length; i += MAX_BULLETS_PER_SLIDE) {
    const chunk = items.slice(i, i + MAX_BULLETS_PER_SLIDE);
    const suffix = i === 0 ? "" : `（${Math.floor(i / MAX_BULLETS_PER_SLIDE) + 1}）`;
    target.push({
      title: `${title}${suffix}`,
      bullets: chunk.filter((c) => c.kind === "bullet").map((c) => c.text),
      paragraphs: chunk.filter((c) => c.kind === "para").map((c) => c.text),
    });
  }
}

/**
 * 依 Markdown 標題／空行將教材本文切成投影片大綱（可單測）。
 */
export function contentToSlides(input: MaterialPresentationInput): MaterialSlide[] {
  const slides: MaterialSlide[] = [];
  const coverTitle = input.unitCode ? `${input.unitCode}｜${input.title}` : input.title;
  slides.push({
    title: coverTitle,
    bullets: [input.category, ...(input.summary ? [input.summary] : [])].filter(Boolean),
    paragraphs: [],
  });

  const text = input.content.replace(/\r\n/g, "\n").trim();
  if (!text) return slides;

  const headingRe = /^(#{1,3})\s+(.+)$/;
  const lines = text.split("\n");
  let currentTitle = "內容";
  let buf: string[] = [];

  const flush = () => {
    if (buf.some((l) => l.trim())) {
      pushChunked(slides, currentTitle, buf);
    }
    buf = [];
  };

  let sawHeading = false;
  for (const line of lines) {
    const m = line.match(headingRe);
    if (m) {
      flush();
      sawHeading = true;
      currentTitle = stripMdInline(m[2]!) || "內容";
      continue;
    }
    buf.push(line);
  }
  flush();

  // 無標題時：以空行分段
  if (!sawHeading && slides.length === 2) {
    const only = slides.pop()!;
    const blocks = text
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean);
    if (blocks.length > 1) {
      blocks.forEach((block, idx) => {
        const blockLines = block.split("\n");
        const first = stripMdInline(blockLines[0] ?? "");
        const rest = blockLines.slice(1);
        const looksLikeTitle = first.length > 0 && first.length <= 40 && rest.length > 0;
        pushChunked(
          slides,
          looksLikeTitle ? first : `重點 ${idx + 1}`,
          looksLikeTitle ? rest : blockLines,
        );
      });
    } else {
      slides.push(only);
    }
  }

  return slides.filter((s) => s.title || s.bullets.length || s.paragraphs.length);
}

function safeFileBase(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "單元教材";
}

export function presentationFileName(input: Pick<MaterialPresentationInput, "title" | "unitCode">): string {
  const base = input.unitCode ? `${input.unitCode}-${input.title}` : input.title;
  return `${safeFileBase(base)}.pptx`;
}

/** 產生 PPTX 二進位（ArrayBuffer） */
export async function buildMaterialPptx(input: MaterialPresentationInput): Promise<ArrayBuffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.author = "Gov Procurement Law Tutor";
  pptx.title = input.title;
  pptx.subject = input.category;
  pptx.layout = "LAYOUT_16x9";

  const colors = {
    accent: "1D4ED8",
    accentLight: "DBEAFE",
    fg: "111827",
    muted: "6B7280",
    white: "FFFFFF",
    bg: "F8FAFC",
  };

  const slides = contentToSlides(input);

  slides.forEach((s, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: colors.bg };
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.08,
      fill: { color: colors.accent },
      line: { color: colors.accent },
    });

    if (index === 0) {
      slide.addText(s.title, {
        x: 0.6,
        y: 2.0,
        w: 8.8,
        h: 1.2,
        fontSize: 30,
        bold: true,
        color: colors.fg,
        fontFace: "Microsoft JhengHei",
        align: "center",
      });
      if (s.bullets.length) {
        slide.addText(s.bullets.join("\n"), {
          x: 1.2,
          y: 3.4,
          w: 7.6,
          h: 1.8,
          fontSize: 16,
          color: colors.muted,
          fontFace: "Microsoft JhengHei",
          align: "center",
        });
      }
      slide.addText("單元教材簡報", {
        x: 0.6,
        y: 5.3,
        w: 8.8,
        h: 0.4,
        fontSize: 12,
        color: colors.accent,
        fontFace: "Microsoft JhengHei",
        align: "center",
      });
      return;
    }

    slide.addText(s.title, {
      x: 0.5,
      y: 0.35,
      w: 9,
      h: 0.7,
      fontSize: 24,
      bold: true,
      color: colors.accent,
      fontFace: "Microsoft JhengHei",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.5,
      y: 1.05,
      w: 9,
      h: 0,
      line: { color: colors.accentLight, width: 2 },
    });

    const body: { text: string; options?: Record<string, unknown> }[] = [];
    for (const b of s.bullets) {
      body.push({ text: b, options: { bullet: true, breakLine: true } });
    }
    for (const p of s.paragraphs) {
      body.push({ text: p, options: { breakLine: true } });
    }
    if (body.length === 0) {
      body.push({ text: "（本段無正文）", options: { color: colors.muted } });
    }

    slide.addText(body, {
      x: 0.55,
      y: 1.25,
      w: 9,
      h: 5.2,
      fontSize: 16,
      color: colors.fg,
      fontFace: "Microsoft JhengHei",
      valign: "top",
      paraSpaceAfter: 8,
    });
  });

  const out = await pptx.write({ outputType: "arraybuffer" });
  return out as ArrayBuffer;
}
