import Link from "next/link";
import { redirect } from "next/navigation";

import { TeacherGuidanceReplyForm } from "@/components/TeacherGuidanceReplyForm";
import { ensureMockExamGuidanceSchema } from "@/lib/ensure-mock-exam-guidance-schema";
import { getSession } from "@/lib/get-session";
import { maskEmail } from "@/lib/pii";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";
import { withRlsBypass } from "@/lib/with-user-rls";

export const dynamic = "force-dynamic";

export default async function TeacherGuidancePage() {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  await ensureMockExamGuidanceSchema();

  const { requests, itemMap } = await withRlsBypass(async (tx) => {
    const requests = await tx.mockExamSupplement.findMany({
      where: { guidanceRequestedAt: { not: null } },
      orderBy: [{ guidanceRepliedAt: "asc" }, { guidanceRequestedAt: "desc" }],
      take: 100,
      include: {
        user: { select: { id: true, email: true, name: true, nickname: true } },
      },
    });
    const itemKeys = [...new Set(requests.map((r) => r.itemKey))];
    const items = await tx.questionBankItem.findMany({
      where: { key: { in: itemKeys } },
      select: { key: true, question: true, category: true, hintAnswer: true },
    });
    return { requests, itemMap: new Map(items.map((i) => [i.key, i])) };
  });

  const pending = requests.filter((r) => !r.guidanceRepliedAt);
  const replied = requests.filter((r) => !!r.guidanceRepliedAt);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">學員請老師指導</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              學員於模擬考試送出「請老師指導」後會出現於此；請填寫「老師指導內容」回覆。
            </p>
          </div>
          <Link href="/teacher" className="text-sm no-underline hover:underline">
            ← 老師工作台
          </Link>
        </div>
        <p className="mt-4 text-sm">
          待回覆 <span className="font-semibold">{pending.length}</span> 件｜已回覆{" "}
          <span className="font-semibold">{replied.length}</span> 件
        </p>
      </div>

      <GuidanceList
        title="待回覆"
        empty="目前沒有待回覆的提問。"
        rows={pending}
        itemMap={itemMap}
        showReply
      />
      <GuidanceList
        title="已回覆"
        empty="尚無已回覆紀錄。"
        rows={replied}
        itemMap={itemMap}
        showReply
      />
    </section>
  );
}

type GuidanceRow = {
  id: string;
  itemKey: string;
  supplement: string;
  sourceNote: string | null;
  guidanceAskNote: string | null;
  guidanceRequestedAt: Date | null;
  guidanceRepliedAt: Date | null;
  teacherGuidance: string | null;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    nickname: string | null;
  };
};

function GuidanceList({
  title,
  empty,
  rows,
  itemMap,
  showReply,
}: {
  title: string;
  empty: string;
  rows: GuidanceRow[];
  itemMap: Map<
    string,
    { key: string; question: string; category: string; hintAnswer: string | null }
  >;
  showReply: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-6">
          {rows.map((r) => {
            const item = itemMap.get(r.itemKey);
            const student =
              r.user.nickname || r.user.name || maskEmail(r.user.email) || r.user.id;
            return (
              <li
                key={r.id}
                className="rounded-lg border border-[var(--border)] bg-slate-50/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-[var(--muted)]">
                  <span>
                    學員：{student}
                    {r.user.email ? `（${maskEmail(r.user.email)}）` : ""}
                  </span>
                  <span>
                    提問時間：
                    {r.guidanceRequestedAt
                      ? new Intl.DateTimeFormat("zh-TW", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(r.guidanceRequestedAt)
                      : "—"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  類別：{item?.category ?? "—"}｜題目 key：{r.itemKey}
                </p>
                <p className="mt-2 text-sm font-medium leading-relaxed">
                  {item?.question ?? r.itemKey}
                </p>
                {item?.hintAnswer ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">題庫導引：{item.hintAnswer}</p>
                ) : null}
                {r.sourceNote ? (
                  <p className="mt-2 text-sm">
                    <span className="font-medium">解答來源註記：</span>
                    {r.sourceNote}
                  </p>
                ) : null}
                {r.supplement ? (
                  <p className="mt-1 text-sm">
                    <span className="font-medium">我的補充筆記：</span>
                    {r.supplement}
                  </p>
                ) : null}
                {r.guidanceAskNote ? (
                  <p className="mt-1 text-sm">
                    <span className="font-medium">學員想問：</span>
                    {r.guidanceAskNote}
                  </p>
                ) : null}
                {showReply ? (
                  <div className="mt-3">
                    <TeacherGuidanceReplyForm
                      id={r.id}
                      initialGuidance={r.teacherGuidance ?? ""}
                      replied={!!r.guidanceRepliedAt}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
