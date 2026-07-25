import Link from "next/link";
import { redirect } from "next/navigation";

import { LearningDashboardCharts } from "@/components/LearningDashboardCharts";
import { TeacherClassDashboardCharts } from "@/components/TeacherClassDashboardCharts";
import { getSession } from "@/lib/get-session";
import { canAccessTeacher } from "@/lib/roles";
import {
  loadTeacherClassDashboard,
  loadTeacherStudentDashboard,
  studentLabel,
} from "@/lib/teacher-dashboard";
import { loadAllStudentsLearning } from "@/lib/teacher-stats";

export const dynamic = "force-dynamic";

export default async function TeacherLearningDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ user?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const sp = searchParams ? await searchParams : {};
  const focusUserId = typeof sp.user === "string" ? sp.user.trim() : "";

  if (focusUserId) {
    const [students, focused] = await Promise.all([
      loadAllStudentsLearning(),
      loadTeacherStudentDashboard(focusUserId),
    ]);
    return (
      <section className="space-y-6">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">學員學習儀表板</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                檢視指定學員的模考趨勢、錯題單元與 AI 回答滿意度。
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/teacher/dashboard" className="no-underline hover:underline">
                全體學員
              </Link>
              <Link href="/teacher/students" className="no-underline hover:underline">
                成績表
              </Link>
              <Link href="/teacher" className="no-underline hover:underline">
                ← 老師工作台
              </Link>
            </div>
          </div>

          <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
            <label className="block min-w-[16rem] flex-1 text-sm">
              <span className="text-[var(--muted)]">選擇學員</span>
              <select
                name="user"
                defaultValue={focusUserId}
                className="mt-1 block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
              >
                <option value="">— 全體學員總覽 —</option>
                {students.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {studentLabel(s)}
                    {s.email ? `（${s.email}）` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              查看
            </button>
          </form>
        </div>

        {!focused ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            找不到該學員。
            <Link href="/teacher/dashboard" className="ml-2 underline">
              返回全體總覽
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
              <h2 className="text-base font-semibold">
                {studentLabel(focused.student)}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{focused.student.email}</p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <dt className="text-[var(--muted)]">模考場次</dt>
                  <dd className="font-semibold">{focused.student.examSessionCount}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">平均／最高</dt>
                  <dd className="font-semibold">
                    {focused.student.avgScorePct != null
                      ? `${focused.student.avgScorePct}%`
                      : "—"}{" "}
                    /{" "}
                    {focused.student.bestScorePct != null
                      ? `${focused.student.bestScorePct}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">提問數</dt>
                  <dd className="font-semibold">{focused.student.questionCount}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">詳細成績</dt>
                  <dd className="font-semibold">
                    <Link
                      href={`/teacher/students?user=${focused.student.userId}`}
                      className="no-underline hover:underline"
                    >
                      開啟成績表 →
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>

            <LearningDashboardCharts
              exam={focused.learning.exam}
              weakUnits={focused.learning.weakUnits}
              feedback={focused.learning.feedback}
              examNote="該學員模考完成時間趨勢（老師檢視）"
              hidePersonalLinks
            />
          </>
        )}
      </section>
    );
  }

  const classData = await loadTeacherClassDashboard();
  const students = classData.students;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">學員學習儀表板</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              可查看全體學員總覽，或指定單一成員的模考趨勢、常見錯題單元與 AI 回答滿意度。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/teacher/students" className="no-underline hover:underline">
              成績表
            </Link>
            <Link href="/teacher" className="no-underline hover:underline">
              ← 老師工作台
            </Link>
          </div>
        </div>

        <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
          <label className="block min-w-[16rem] flex-1 text-sm">
            <span className="text-[var(--muted)]">選擇學員</span>
            <select
              name="user"
              defaultValue=""
              className="mt-1 block w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
            >
              <option value="">— 全體學員總覽 —</option>
              {students.map((s) => (
                <option key={s.userId} value={s.userId}>
                  {studentLabel(s)}
                  {s.email ? `（${s.email}）` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            查看
          </button>
        </form>
      </div>

      <TeacherClassDashboardCharts data={classData} />
    </section>
  );
}
