import { Suspense } from "react";
import Link from "next/link";

import { MaterialsBrowser } from "@/components/MaterialsBrowser";
import { loadPublishedMaterialSummaries } from "@/lib/materials-public";

/** ISR：列表只查摘要；id／分類由客戶端讀 URL，全文走 /api/materials/[id] */
export const revalidate = 60;

export default async function MaterialsPage() {
  const materials = await loadPublishedMaterialSummaries();

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">單元教材</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              由老師依主題分類發布的課程單元。列表先載入摘要，點選後再取得全文。
            </p>
          </div>
          <Link href="/" className="text-sm no-underline hover:underline">
            ← 回到首頁
          </Link>
        </div>

        {materials.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--muted)]">目前尚無已發布的單元教材。</p>
        ) : (
          <Suspense fallback={<p className="mt-6 text-sm text-[var(--muted)]">載入教材列表…</p>}>
            <MaterialsBrowser materials={materials} />
          </Suspense>
        )}
      </div>
    </section>
  );
}
