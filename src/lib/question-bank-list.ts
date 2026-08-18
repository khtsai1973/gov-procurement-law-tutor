/**
 * 公開題庫列表的純函式／型別（可給客戶端使用，勿引入 Prisma）。
 */

export const QUESTION_BANK_PAGE_SIZE = 40;

export type QuestionBankListQuery = {
  category: string;
  q: string;
  important: boolean;
  page: number;
};

/** 列表列不含 hintAnswer，避免把完整解析塞進 HTML／首屏 JSON */
export type QuestionBankListItem = {
  id: string;
  key: string;
  question: string;
  category: string;
  keywords: string[];
  importance: "high" | "normal";
  hasHint: boolean;
  hasFullExplanation: boolean;
};

export type QuestionBankListResult = {
  items: QuestionBankListItem[];
  filteredCount: number;
  totalPages: number;
  page: number;
};

export type QuestionBankExplanationPayload = {
  key: string;
  hintAnswer: string | null;
  hasFullExplanation: boolean;
  label: string;
};

export function parseQuestionBankListQuery(input: {
  category?: string | null;
  q?: string | null;
  important?: string | null;
  page?: string | null;
}): QuestionBankListQuery {
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const q = typeof input.q === "string" ? input.q.trim() : "";
  const important = input.important === "1" || input.important === "true";
  const page = Math.max(1, Number.parseInt(String(input.page ?? "1"), 10) || 1);
  return { category, q, important, page };
}

export function questionBankHref(params: {
  category?: string;
  q?: string;
  important?: boolean;
  page?: number;
}): string {
  const next = new URLSearchParams();
  if (params.category) next.set("category", params.category);
  if (params.q) next.set("q", params.q);
  if (params.important) next.set("important", "1");
  if (params.page && params.page > 1) next.set("page", String(params.page));
  const s = next.toString();
  return s ? `/question-bank?${s}` : "/question-bank";
}

/** 預設列表（無篩選、第 1 頁）可由 ISR HTML 直接帶出，避免 LCP 等客戶端 fetch */
export function isDefaultQuestionBankQuery(query: QuestionBankListQuery): boolean {
  return !query.category && !query.q && !query.important && query.page === 1;
}
