import Link from "next/link";
import { redirect } from "next/navigation";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher, roleLabel } from "@/lib/roles";
import { loadAllStudentsLearning } from "@/lib/teacher-stats";

export const dynamic = "force-dynamic";

export default async function TeacherHomePage() {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  await ensureTeacherSchema();

  const [materialCount, publishedCount, students] = await Promise.all([
    prisma.unitMaterial.count(),
    prisma.unitMaterial.count({ where: { published: true } }),
    loadAllStudentsLearning(),
  ]);

  const withExams = students.filter((s) => s.examSessionCount > 0).length;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">老師工作台</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              身分：{roleLabel(session.user.role)}。可製作單元教材，並檢視學員學習成績。
            </p>
          </div>
          <Link href="/" className="text-sm no-underline hover:underline">
            ← 回到首頁
          </Link>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-3">
            <dt className="text-xs text-[var(--muted)]">單元教材數</dt>
            <dd className="mt-1 text-xl font-semibold">{materialCount}</dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-3">
            <dt className="text-xs text-[var(--muted)]">已發布</dt>
            <dd className="mt-1 text-xl font-semibold">{publishedCount}</dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-3">
            <dt className="text-xs text-[var(--muted)]">學員人數</dt>
            <dd className="mt-1 text-xl font-semibold">{students.length}</dd>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-3">
            <dt className="text-xs text-[var(--muted)]">已有考試紀錄</dt>
            <dd className="mt-1 text-xl font-semibold">{withExams}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/teacher/materials"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-blue-800"
          >
            製作單元教材
          </Link>
          <Link
            href="/teacher/students"
            className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--fg)] no-underline hover:bg-slate-50"
          >
            學員成績與學習資料
          </Link>
          <Link
            href="/materials"
            className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--muted)] no-underline hover:bg-slate-50"
          >
            預覽學員教材頁
          </Link>
        </div>
      </div>
    </section>
  );
}
