import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/get-session";
import { mockExamTypeLabel } from "@/lib/mock-exam";
import { maskEmail } from "@/lib/pii";
import { canAccessTeacher, roleLabel } from "@/lib/roles";
import {
  loadAllStudentsLearning,
  loadStudentLearningDetail,
} from "@/lib/teacher-stats";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ user?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const sp = searchParams ? await searchParams : {};
  const focusUserId = sp.user?.trim() || null;

  const [students, detail] = await Promise.all([
    loadAllStudentsLearning(),
    focusUserId ? loadStudentLearningDetail(focusUserId) : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">學員成績與學習資料</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              檢視所有學員的模擬考試成績、提問次數與近期學習活動。
            </p>
          </div>
          <Link href="/teacher" className="text-sm no-underline hover:underline">
            ← 老師工作台
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="py-2 pr-3 font-medium">學員</th>
                <th className="py-2 pr-3 font-medium">角色</th>
                <th className="py-2 pr-3 font-medium">考試場次</th>
                <th className="py-2 pr-3 font-medium">平均分</th>
                <th className="py-2 pr-3 font-medium">最高分</th>
                <th className="py-2 pr-3 font-medium">提問數</th>
                <th className="py-2 pr-3 font-medium">最近考試</th>
                <th className="py-2 font-medium">詳細</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-[var(--muted)]">
                    尚無學員資料。
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s.userId}
                    className={`border-b border-[var(--border)] last:border-b-0 ${
                      focusUserId === s.userId ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <td className="py-2 pr-3">
                      <div className="font-medium">
                        {s.nickname ?? s.name ?? "（未設定暱稱）"}
                      </div>
                      <div className="text-xs text-[var(--muted)]">{maskEmail(s.email)}</div>
                    </td>
                    <td className="py-2 pr-3">{roleLabel(s.role)}</td>
                    <td className="py-2 pr-3">{s.examSessionCount}</td>
                    <td className="py-2 pr-3">
                      {s.avgScorePct != null ? `${s.avgScorePct}%` : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {s.bestScorePct != null ? `${s.bestScorePct}%` : "—"}
                    </td>
                    <td className="py-2 pr-3">{s.questionCount}</td>
                    <td className="py-2 pr-3 text-xs">{fmtDate(s.lastExamAt)}</td>
                    <td className="py-2">
                      <Link
                        href={`/teacher/students?user=${s.userId}`}
                        className="no-underline hover:underline"
                      >
                        檢視
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {focusUserId ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          {!detail ? (
            <p className="text-sm text-[var(--muted)]">找不到該學員。</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    {detail.nickname ?? detail.name ?? maskEmail(detail.email) ?? "學員"}｜詳細學習資料
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{maskEmail(detail.email)}</p>
                </div>
                <Link href="/teacher/students" className="text-sm no-underline hover:underline">
                  關閉詳細
                </Link>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <dt className="text-[var(--muted)]">考試場次</dt>
                  <dd className="font-semibold">{detail.examSessionCount}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">平均／最高</dt>
                  <dd className="font-semibold">
                    {detail.avgScorePct != null ? `${detail.avgScorePct}%` : "—"} /{" "}
                    {detail.bestScorePct != null ? `${detail.bestScorePct}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">提問數</dt>
                  <dd className="font-semibold">{detail.questionCount}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">最近提問</dt>
                  <dd className="font-semibold text-xs">{fmtDate(detail.lastQuestionAt)}</dd>
                </div>
              </dl>

              <h3 className="mt-6 text-sm font-semibold">最近模擬考試</h3>
              {detail.recentExams.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">尚無完成的考試。</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {detail.recentExams.map((exam) => (
                    <li
                      key={exam.id}
                      className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-2 last:border-b-0"
                    >
                      <span>
                        {mockExamTypeLabel(exam.questionType)}｜{exam.correctCount}/
                        {exam.gradableCount}
                        {exam.scorePct != null ? `（${exam.scorePct}%）` : ""}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {fmtDate(exam.finishedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-6 text-sm font-semibold">最近提問</h3>
              {detail.recentQuestions.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">尚無提問紀錄。</p>
              ) : (
                <ul className="mt-2 space-y-3 text-sm">
                  {detail.recentQuestions.map((q) => (
                    <li key={q.id} className="border-b border-[var(--border)] pb-3 last:border-b-0">
                      <div className="text-xs text-[var(--muted)]">
                        {fmtDate(q.createdAt)}
                        {q.feedback ? `｜回饋 ${q.feedback}` : ""}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap line-clamp-3">{q.question}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
