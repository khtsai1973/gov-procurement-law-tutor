import Link from "next/link";
import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { IngestForm } from "@/components/IngestForm";
import { formatPercent, loadAnswerFeedbackStats } from "@/lib/answer-feedback-stats";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const [syncs, feedbackStats] = await Promise.all([
    prisma.knowledgeSync.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    loadAnswerFeedbackStats(),
  ]);

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
        <h2 className="text-base font-semibold">模型回答品質評估（使用者回饋）</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          統計來自問答頁 👍／👎 與簡易回饋，可作為期末報告 Evaluation 量化指標。
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-3">
            <dt className="text-xs text-[var(--muted)]">有回答的提問數</dt>
            <dd className="mt-1 text-xl font-semibold">{feedbackStats.totalAnswers}</dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-3">
            <dt className="text-xs text-[var(--muted)]">已評分數</dt>
            <dd className="mt-1 text-xl font-semibold">{feedbackStats.ratedCount}</dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-3">
            <dt className="text-xs text-[var(--muted)]">👍 / 👎</dt>
            <dd className="mt-1 text-xl font-semibold">
              {feedbackStats.upCount} / {feedbackStats.downCount}
            </dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-3">
            <dt className="text-xs text-[var(--muted)]">滿意度（👍÷已評分）</dt>
            <dd className="mt-1 text-xl font-semibold">
              {formatPercent(feedbackStats.satisfactionRate)}
            </dd>
          </div>
        </dl>

        {feedbackStats.byModel.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <h3 className="text-sm font-semibold">依模型／模式</h3>
            <table className="mt-2 w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">模型／模式</th>
                  <th className="py-2 pr-3 font-medium">已評分</th>
                  <th className="py-2 pr-3 font-medium">👍</th>
                  <th className="py-2 pr-3 font-medium">👎</th>
                  <th className="py-2 font-medium">滿意度</th>
                </tr>
              </thead>
              <tbody>
                {feedbackStats.byModel.map((row) => (
                  <tr key={row.model} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="py-2 pr-3">{row.model}</td>
                    <td className="py-2 pr-3">{row.ratedCount}</td>
                    <td className="py-2 pr-3">{row.upCount}</td>
                    <td className="py-2 pr-3">{row.downCount}</td>
                    <td className="py-2">{formatPercent(row.satisfactionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">尚無回饋資料。</p>
        )}

        {feedbackStats.recentComments.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">最近文字回饋</h3>
            <ul className="mt-3 space-y-3 text-sm">
              {feedbackStats.recentComments.map((item) => (
                <li key={item.id} className="border-b border-[var(--border)] pb-3 last:border-b-0">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                    <span>
                      {new Intl.DateTimeFormat("zh-TW", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(item.feedbackAt)}
                    </span>
                    <span>{item.feedback === "UP" ? "👍" : "👎"}</span>
                    {item.answerModel ? <span>{item.answerModel}</span> : null}
                  </div>
                  <p className="mt-1 text-[var(--muted)] line-clamp-2">Q：{item.question}</p>
                  <p className="mt-1">{item.comment}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
