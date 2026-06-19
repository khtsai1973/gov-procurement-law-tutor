import Link from "next/link";
import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { IngestForm } from "@/components/IngestForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const syncs = await prisma.knowledgeSync.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">管理者：知識庫維護</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
              將每部法規／函釋整理成 UTF-8 純文字 Markdown，檔名必須為{" "}
              <code className="rounded bg-gray-100 px-1">slug.md</code>，置於專案根目錄{" "}
              <code className="rounded bg-gray-100 px-1">data/corpus/</code>。按下「載入／更新知識庫」會重新切分全文並寫入資料庫（以最新檔案內容為準）。
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              <li>
                函釋建議逐號拆檔（或依主題分段），並在資料庫為每份函釋建立獨立 regulation 列與{" "}
                <code className="rounded bg-gray-100 px-1">INTERPRETATION</code> 位階。
              </li>
              <li>最後修改日期與來源連結可在資料表 regulation 中維護，或擴充管理介面編修。</li>
            </ul>
          </div>
          <Link href="/" className="text-sm no-underline hover:underline">
            ← 回到問答
          </Link>
        </div>

        <div className="mt-6">
          <IngestForm />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">最近同步紀錄</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {syncs.map((s) => (
            <li key={s.id} className="flex flex-wrap gap-x-3 gap-y-1 border-b border-[var(--border)] py-2 last:border-b-0">
              <span className="text-[var(--muted)]">
                {new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(s.createdAt)}
              </span>
              <span className="font-medium">{s.status}</span>
              <span className="text-[var(--muted)]">{s.triggeredBy}</span>
              {s.message ? <span>{s.message}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
