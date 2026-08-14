import { MockExamPanel } from "@/components/MockExamPanel";
import { loadMockExamCategoryOptions } from "@/lib/question-bank-public";

/** 類別選項可快取；登入態與個人紀錄改由客戶端載入以降低 TTFB */
export const revalidate = 60;

export default async function MockExamPage() {
  const categories = await loadMockExamCategoryOptions();
  return <MockExamPanel categories={categories} />;
}
