import Link from "next/link";

import { isDatabaseReady } from "@/lib/ensure-db";
import prisma from "@/lib/prisma";
import { tierLabel, tierSortKey } from "@/lib/tier-order";

export const dynamic = "force-dynamic";

export default async function RegulationsPage() {
  const ready = await isDatabaseReady();

  if (!ready) {
    return (
      <section className="mx-auto max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">資料庫尚未初始化</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          找不到 Regulation 資料表。請在專案目錄執行一次資料庫建立與種子資料。
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
{`# 設定 DATABASE_URL（Neon 或本機 Postgres）後執行
npm run db:init
npm run corpus:rag-init   # 選填，語意檢索需 OPENAI_API_KEY`}
        </pre>
        <p className="mt-3 text-sm text-[var(--muted)]">
          正式環境步驟見 <code>DEPLOY.md</code>；本機可執行 <code>powershell -File .\\init-db.ps1</code>
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          返回首頁
        </Link>
      </section>
    );
  }

  const rows = await prisma.regulation.findMany();
  rows.sort((a, b) => tierSortKey(a.tier, a.sortOrder) - tierSortKey(b.tier, b.sortOrder));

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">法規／函釋清單</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            依「位階」由高到低排列（法律 → 法規命令 → 行政規則／要點 → 函釋）；同一位階內再以管理用的排序欄位排列。
          </p>
        </div>
        <Link href="/" className="text-sm no-underline hover:underline">
          ← 回到問答
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted)]">
              <th className="py-2 pr-4 font-medium">位階</th>
              <th className="py-2 pr-4 font-medium">名稱</th>
              <th className="py-2 pr-4 font-medium">最後修改日期</th>
              <th className="py-2 pr-4 font-medium">連結</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)] align-top">
                <td className="py-3 pr-4 whitespace-nowrap">{tierLabel(r.tier)}</td>
                <td className="py-3 pr-4">
                  <div className="font-medium">{r.title}</div>
                  {r.notes ? <div className="mt-1 text-xs text-[var(--muted)]">{r.notes}</div> : null}
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  {r.lastModifiedAt
                    ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(r.lastModifiedAt)
                    : "—"}
                </td>
                <td className="py-3 pr-4">
                  <a href={r.sourceUrl ?? "#"} className="break-all" target="_blank" rel="noreferrer">
                    來源
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
