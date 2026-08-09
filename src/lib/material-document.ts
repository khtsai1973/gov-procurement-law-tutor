/**
 * 將單元教材匯出為文件（DOCX / PDF）。
 * 與簡報 PPTX 分開：文件保留完整教材正文結構，不經投影片排版。
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

export type MaterialDocumentInput = {
  title: string;
  category: string;
  unitCode?: string | null;
  summary?: string | null;
  content: string;
};

export type DocumentBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "paragraph"; text: string };

function stripMdInline(text: string): string {
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/^>\s?/gm, "")
    .trim();
}

function safeFileBase(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "單元教材";
}

export function documentFileName(
  input: Pick<MaterialDocumentInput, "title" | "unitCode">,
  ext: "docx" | "pdf",
): string {
  const base = input.unitCode ? `${input.unitCode}-${input.title}` : input.title;
  return `${safeFileBase(base)}.${ext}`;
}

/** 將教材 Markdown 粗切為文件區塊（可單測） */
export function contentToDocumentBlocks(content: string): DocumentBlock[] {
  const text = content.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const blocks: DocumentBlock[] = [];
  const headingRe = /^(#{1,3})\s+(.+)$/;
  const bulletRe = /^[-*+]\s+(.+)$/;
  const numberedRe = /^\d+[.)]\s+(.+)$/;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const hm = line.match(headingRe);
    if (hm) {
      const level = Math.min(hm[1]!.length, 3) as 1 | 2 | 3;
      const t = stripMdInline(hm[2]!);
      if (t) blocks.push({ kind: "heading", level, text: t });
      continue;
    }

    const bm = line.match(bulletRe) || line.match(numberedRe);
    if (bm) {
      const t = stripMdInline(bm[1]!);
      if (t) blocks.push({ kind: "bullet", text: t });
      continue;
    }

    const t = stripMdInline(line);
    if (t) blocks.push({ kind: "paragraph", text: t });
  }

  return blocks;
}

function displayTitle(input: MaterialDocumentInput): string {
  return input.unitCode ? `${input.unitCode}｜${input.title}` : input.title;
}

function resolveCjkFontPath(weight: 400 | 700 = 400): string {
  const file =
    weight === 700
      ? "noto-sans-tc-chinese-traditional-700-normal.woff"
      : "noto-sans-tc-chinese-traditional-400-normal.woff";
  const candidates = [
    path.join(
      process.cwd(),
      "node_modules/@fontsource/noto-sans-tc/files",
      file,
    ),
    path.join(
      process.cwd(),
      "node_modules",
      "@fontsource",
      "noto-sans-tc",
      "files",
      file,
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`找不到中文字型：${file}（請確認已安裝 @fontsource/noto-sans-tc）`);
}

/** 產生 DOCX（Buffer） */
export async function buildMaterialDocx(input: MaterialDocumentInput): Promise<Buffer> {
  const title = displayTitle(input);
  const blocks = contentToDocumentBlocks(input.content);
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 36,
          font: "Microsoft JhengHei",
        }),
      ],
    }),
  );

  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `分類：${input.category}`,
          size: 20,
          color: "6B7280",
          font: "Microsoft JhengHei",
        }),
      ],
    }),
  );

  if (input.summary?.trim()) {
    children.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: input.summary.trim(),
            italics: true,
            size: 22,
            font: "Microsoft JhengHei",
          }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      border: {
        bottom: { color: "DBEAFE", space: 1, style: "single", size: 12 },
      },
      spacing: { after: 240 },
      children: [],
    }),
  );

  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  } as const;

  if (blocks.length === 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "（本教材尚無正文）",
            color: "6B7280",
            font: "Microsoft JhengHei",
          }),
        ],
      }),
    );
  } else {
    for (const b of blocks) {
      if (b.kind === "heading") {
        children.push(
          new Paragraph({
            heading: headingMap[b.level],
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: b.text,
                bold: true,
                size: b.level === 1 ? 28 : b.level === 2 ? 24 : 22,
                font: "Microsoft JhengHei",
              }),
            ],
          }),
        );
      } else if (b.kind === "bullet") {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            indent: { left: 360 },
            children: [
              new TextRun({
                text: `• ${b.text}`,
                size: 22,
                font: "Microsoft JhengHei",
              }),
            ],
          }),
        );
      } else {
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: b.text,
                size: 22,
                font: "Microsoft JhengHei",
              }),
            ],
          }),
        );
      }
    }
  }

  const doc = new Document({
    creator: "Gov Procurement Law Tutor",
    title: input.title,
    description: input.summary ?? input.category,
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/** 產生 PDF（Buffer），內嵌繁中字型 */
export async function buildMaterialPdf(input: MaterialDocumentInput): Promise<Buffer> {
  const fontRegular = resolveCjkFontPath(400);
  let fontBold = fontRegular;
  try {
    fontBold = resolveCjkFontPath(700);
  } catch {
    fontBold = fontRegular;
  }

  const title = displayTitle(input);
  const blocks = contentToDocumentBlocks(input.content);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 56,
      size: "A4",
      info: {
        Title: input.title,
        Author: "Gov Procurement Law Tutor",
        Subject: input.category,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      doc.font(fontBold).fontSize(20).fillColor("#111827").text(title, {
        align: "left",
      });
      doc.moveDown(0.4);
      doc.font(fontRegular).fontSize(11).fillColor("#6B7280").text(`分類：${input.category}`);
      if (input.summary?.trim()) {
        doc.moveDown(0.35);
        doc.font(fontRegular).fontSize(11).fillColor("#374151").text(input.summary.trim());
      }
      doc.moveDown(0.6);
      const y = doc.y;
      doc
        .strokeColor("#DBEAFE")
        .lineWidth(2)
        .moveTo(56, y)
        .lineTo(doc.page.width - 56, y)
        .stroke();
      doc.moveDown(0.8);
      doc.fillColor("#111827");

      if (blocks.length === 0) {
        doc.font(fontRegular).fontSize(12).fillColor("#6B7280").text("（本教材尚無正文）");
      } else {
        for (const b of blocks) {
          if (b.kind === "heading") {
            const size = b.level === 1 ? 16 : b.level === 2 ? 14 : 13;
            doc.moveDown(0.35);
            doc.font(fontBold).fontSize(size).fillColor("#1D4ED8").text(b.text, {
              align: "left",
            });
            doc.moveDown(0.15);
            doc.fillColor("#111827");
          } else if (b.kind === "bullet") {
            doc.font(fontRegular).fontSize(12).text(`• ${b.text}`, {
              indent: 12,
              paragraphGap: 4,
            });
          } else {
            doc.font(fontRegular).fontSize(12).text(b.text, {
              paragraphGap: 6,
              lineGap: 2,
            });
          }
        }
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
