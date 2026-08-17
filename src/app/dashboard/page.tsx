import Link from "next/link";
import { redirect } from "next/navigation";

import { LearningDashboardCharts } from "@/components/LearningDashboardCharts";
import { getSession } from "@/lib/get-session";
import { loadLearningDashboard } from "@/lib/learning-dashboard";

export const dynamic = "force-dynamic";

export default async function LearningDashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  const data = await loadLearningDashboard(session.user.id);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">個人學習與評估儀表板</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              彙整模考分數趨勢、常見錯題單元，以及您對 AI 回答的滿意度統計，協助安排複習重點。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/mock-exam" className="no-underline hover:underline">
              模擬考試
            </Link>
            <Link href="/my-questions" className="no-underline hover:underline">
              我的提問
            </Link>
            <Link href="/" className="no-underline hover:underline">
              ← 回到問答
            </Link>
          </div>
        </div>
      </div>

      <LearningDashboardCharts
        exam={data.exam}
        weakUnits={data.weakUnits}
        feedback={data.feedback}
      />
    </section>
  );
}
