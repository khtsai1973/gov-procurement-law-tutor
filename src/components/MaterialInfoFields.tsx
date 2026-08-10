import type { MaterialInfoFields as Info } from "@/lib/material-info";

/** 教材五項資訊欄位（法規版本／產生／審核／修正） */
export function MaterialInfoFields({
  info,
  className = "",
}: {
  info: Info;
  className?: string;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "法規版本", value: info.regulationVersion },
    { label: "產生日期", value: info.generatedAt },
    { label: "教師審核日期", value: info.reviewedAt },
    { label: "審核人員", value: info.reviewer },
    { label: "最後修正紀錄", value: info.lastRevision },
  ];

  return (
    <dl
      className={`grid gap-2 rounded-md border border-[var(--border)] bg-slate-50/70 px-3 py-3 text-xs text-[var(--muted)] sm:grid-cols-2 ${className}`}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className={row.label === "最後修正紀錄" ? "sm:col-span-2" : undefined}
        >
          <dt className="font-medium text-[var(--fg)]/80">{row.label}</dt>
          <dd className="mt-0.5 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
