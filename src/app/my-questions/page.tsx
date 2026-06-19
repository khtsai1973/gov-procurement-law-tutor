import Link from "next/link";
import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function MyQuestionsPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  const items = await prisma.userQuestion.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">我的提問紀錄</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">最近 100 筆，依時間新近排序。</p>
        </div>
        <Link href="/" className="text-sm no-underline hover:underline">
          ← 回到問答
        </Link>
      </div>

      <ul className="mt-6 space-y-6">
        {items.map((row) => (
          <li key={row.id} className="border-b border-[var(--border)] pb-6 last:border-b-0">
            <div className="text-xs text-[var(--muted)]">
              {new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short" }).format(row.createdAt)}
            </div>
            <div className="mt-2 text-sm font-semibold">Q</div>
            <div className="whitespace-pre-wrap text-sm">{row.question}</div>
            {row.answer ? (
              <>
                <div className="mt-3 text-sm font-semibold">A</div>
                <div className="whitespace-pre-wrap text-sm">{row.answer}</div>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
