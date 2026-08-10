import Link from "next/link";

import { MaterialsBrowser } from "@/components/MaterialsBrowser";
import { getSession } from "@/lib/get-session";
import {
  loadPublishedMaterialDetail,
  loadPublishedMaterialSummaries,
} from "@/lib/materials-public";

/** 列表摘要可快取；點選後再取全文 */
export const revalidate = 60;

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; category?: string }>;
}) {
  const session = await getSession();
  const sp = searchParams ? await searchParams : {};
  const focusId = sp.id?.trim() || null;
  const filterCategory = sp.category?.trim() || null;

  const materials = await loadPublishedMaterialSummaries();

  const filtered = filterCategory
    ? materials.filter((m) => m.category === filterCategory)
    : materials;
  const selectedId =
    focusId && filtered.some((m) => m.id === focusId)
      ? focusId
      : (filtered[0]?.id ?? null);

  // 僅預取「目前選中」一篇全文，避免一次載入全部 content
  const initialDetail = selectedId
    ? await loadPublishedMaterialDetail(selectedId)
    : null;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">單元教材</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              由老師依主題分類發布的課程單元。列表先載入摘要，點選後再取得全文。
              {session?.user ? "" : "登入後可一併使用問答與模擬考試。"}
            </p>
          </div>
          <Link href="/" className="text-sm no-underline hover:underline">
            ← 回到首頁
          </Link>
        </div>

        {materials.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--muted)]">目前尚無已發布的單元教材。</p>
        ) : (
          <MaterialsBrowser
            key={`${selectedId ?? "none"}:${filterCategory ?? "all"}`}
            materials={materials}
            initialId={selectedId}
            filterCategory={filterCategory}
            initialDetail={initialDetail}
          />
        )}
      </div>
    </section>
  );
}
