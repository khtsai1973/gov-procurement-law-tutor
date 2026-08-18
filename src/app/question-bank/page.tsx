import { Suspense } from "react";
import Link from "next/link";

import { QuestionBankBrowser, QuestionBankListView } from "@/components/QuestionBankBrowser";
import { QuestionBankTeacherLink, QuestionBankUserSection } from "@/components/QuestionBankUserSection";
import { loadQuestionBankCategorySummary, loadQuestionBankPage } from "@/lib/question-bank-public";

/** ISR 殼＋預設第 1 頁題目（不含解析）；篩選改客戶端 fetch */
export const revalidate = 60;

export default async function QuestionBankPage() {
  const [{ categories, totalCount }, initialPage] = await Promise.all([
    loadQuestionBankCategorySummary(),
    loadQuestionBankPage({ category: "", q: "", important: false, page: 1 }),
  ]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">題庫</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              政府採購法規常見試題整理，供學習與模擬考試參考。登入後可結合模考紀錄做弱點分析，並對單題使用
              AI 錯題原因分析。高頻／重要題優先提供完整教學解析。
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              共 {totalCount} 題、{categories.length} 個分類
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/mock-exam" className="no-underline hover:underline">
              模擬考試
            </Link>
            <QuestionBankTeacherLink />
            <Link href="/" className="no-underline hover:underline">
              ← 回到問答
            </Link>
          </div>
        </div>
      </div>

      <QuestionBankUserSection />

      <Suspense
        fallback={
          <QuestionBankListView
            totalCount={totalCount}
            data={initialPage}
            query={{ category: "", q: "", important: false, page: 1 }}
          />
        }
      >
        <QuestionBankBrowser totalCount={totalCount} initialData={initialPage} />
      </Suspense>
    </section>
  );
}
