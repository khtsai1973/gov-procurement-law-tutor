import Link from "next/link";
import { redirect } from "next/navigation";

import { TeacherAnonymousDashboardCharts } from "@/components/TeacherAnonymousDashboardCharts";
import { getSession } from "@/lib/get-session";
import { canAccessTeacher, roleLabel } from "@/lib/roles";
import { loadAnonymousCohortDashboard } from "@/lib/teacher-anonymous-dashboard";

export const dynamic = "force-dynamic";

export default async function TeacherAnonymousDashboardPage() {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    redirect("/");
  }

  const data = await loadAnonymousCohortDashboard();

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--muted)]">老師／{roleLabel(session.user.role)}</p>
            <h1 className="mt-1 text-xl font-semibold">全體學員匿名化統計儀表板</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              僅顯示彙總指標與分布圖，不包含姓名、信箱或可追蹤的學員編號。若需個別輔導，請至「學員成績與學習資料」（信箱已遮罩）。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/teacher" className="no-underline hover:underline">
              ← 老師工作台
            </Link>
            <Link href="/teacher/students" className="no-underline hover:underline">
              學員個別資料
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          隱私：本頁資料標記為 <code className="rounded bg-white/80 px-1">anonymized: true</code>
          ，輸出不含 email／name／nickname／userId。
        </div>
      </div>

      <TeacherAnonymousDashboardCharts data={data} />
    </section>
  );
}
