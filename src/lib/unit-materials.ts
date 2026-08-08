import { OFFICIAL_QUESTION_BANK_CATEGORIES } from "@/lib/question-bank-categories";

export type MaterialListItem = {
  id: string;
  title: string;
  category: string;
  unitCode: string | null;
  summary?: string | null;
  sortOrder?: number;
  published?: boolean;
};

/** 依正式 14 類順序分組；未知分類置於最後 */
export function groupMaterialsByCategory<T extends MaterialListItem>(
  materials: T[],
): { category: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const m of materials) {
    const key = m.category?.trim() || "未分類";
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }

  const groups: { category: string; items: T[] }[] = [];
  for (const cat of OFFICIAL_QUESTION_BANK_CATEGORIES) {
    const items = map.get(cat);
    if (items?.length) {
      groups.push({ category: cat, items });
      map.delete(cat);
    }
  }
  for (const [category, items] of map) {
    groups.push({ category, items });
  }
  return groups;
}
