import { access, readdir } from "node:fs/promises";
import path from "node:path";

/** Fixed default filename (UTF-8 in source). */
export const DEFAULT_QUESTION_BANK_PDF_NAME = "政府採購法規全部題庫.pdf";

/** Some exports insert a space between 題 and 庫 in the filename. */
export const DEFAULT_QUESTION_BANK_PDF_NAME_SPACED = "政府採購法規全部題 庫.pdf";

const QUESTION_BANK_PDF_NAME_RE = /題\s*庫/;

export function isQuestionBankPdfFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf") && QUESTION_BANK_PDF_NAME_RE.test(name);
}

/**
 * Resolve the question-bank PDF: explicit --pdf path, fixed default, or glob *題*庫*.pdf in project root.
 */
export async function resolveQuestionBankPdfPath(
  root: string,
  explicitPath?: string,
): Promise<string> {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  const fixedCandidates = [
    DEFAULT_QUESTION_BANK_PDF_NAME,
    DEFAULT_QUESTION_BANK_PDF_NAME_SPACED,
  ];
  for (const name of fixedCandidates) {
    const fixed = path.join(root, name);
    try {
      await access(fixed);
      return fixed;
    } catch {
      /* try next */
    }
  }

  const fixed = path.join(root, DEFAULT_QUESTION_BANK_PDF_NAME);

  let names: string[] = [];
  try {
    names = await readdir(root);
  } catch {
    return fixed;
  }

  const pdfMatches = names.filter(isQuestionBankPdfFilename);
  if (pdfMatches.length === 1) {
    return path.join(root, pdfMatches[0]!);
  }
  if (pdfMatches.length > 1) {
    const preferred = pdfMatches.find((n) => n.includes("全部"));
    return path.join(root, preferred ?? pdfMatches[0]!);
  }

  return fixed;
}
