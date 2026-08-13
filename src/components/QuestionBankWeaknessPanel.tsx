import Link from "next/link";

import type { UserQuestionBankWeakness } from "@/lib/question-bank-weakness";

/** 題庫頁：依模擬考試歷史顯示弱點分析摘要 */
export function QuestionBankWeaknessPanel({
  weakness,
}: {
  weakness: UserQuestionBankWeakness;
}) {
  if (weakness.totalGraded === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <h2 className="text-sm font-semibold">學習弱點儀表板（結合模擬考試）</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          完成模擬考試並交卷後，系統會依題庫標籤彙總能力矩陣與弱點，並可在模考結果頁產生《個人化學習弱點診斷書》。
        </p>
        <p className="mt-3 text-sm">
          <Link href="/mock-exam" className="font-medium no-underline hover:underline">
            前往模擬考試 →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-950">學習弱點儀表板（結合模擬考試）</h2>
          <p className="mt-1 text-xs text-amber-900/80">
            依最近模考 {weakness.totalGraded} 題評分結果統計；錯題 {weakness.totalWrong}{" "}
            題。完整《個人化學習弱點診斷書》請至模考結果頁查看。
          </p>
        </div>
        <Link
          href="/mock-exam"
          className="text-xs font-medium text-amber-950 no-underline hover:underline"
        >
          再測一次 →
        </Link>
      </div>

      {weakness.weakTags.length > 0 ? (
        <p className="mt-3 text-sm text-amber-950">
          <span className="font-medium">關鍵弱點：</span>
          {weakness.weakTags.join("、")}
        </p>
      ) : null}

      {weakness.weakCategories.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {weakness.weakCategories.map((c) => (
            <li key={c.category} className="flex flex-wrap items-baseline justify-between gap-2">
              <Link
                href={`/question-bank?category=${encodeURIComponent(c.category)}&important=1`}
                className="text-amber-950 no-underline hover:underline"
              >
                {c.category}
              </Link>
              <span className="text-xs text-amber-900/80">
                正確率 {c.pct}%（錯 {c.wrong}/{c.total}）
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {weakness.strongTags.length > 0 ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          核心強項（正確率 ≥ 85%）：{weakness.strongTags.join("、")}
        </p>
      ) : null}
    </div>
  );
}
