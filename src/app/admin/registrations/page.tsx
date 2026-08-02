import Link from "next/link";
import { redirect } from "next/navigation";

import { RegistrationReviewForm } from "@/components/RegistrationReviewForm";
import { ensureRegistrationSchema } from "@/lib/ensure-registration-schema";
import { getSession } from "@/lib/get-session";
import { maskEmail } from "@/lib/pii";
import prisma from "@/lib/prisma";
import {
  registrationStatusLabel,
  requestedRoleLabel,
} from "@/lib/registration";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AdminRegistrationsPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    redirect("/");
  }

  await ensureRegistrationSchema();

  const apps = await prisma.registrationApplication.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const pending = apps.filter((a) => a.status === "PENDING");
  const others = apps.filter((a) => a.status !== "PENDING");

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">註冊申請審核</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              審核訪客申請的「一般使用者」或「老師」角色；核准後對方可用同一 Google 帳號登入加入。
            </p>
          </div>
          <Link href="/admin" className="text-sm no-underline hover:underline">
            ← 管理者首頁
          </Link>
        </div>
        <p className="mt-4 text-sm">
          待審核 <span className="font-semibold">{pending.length}</span> 件
        </p>
      </div>

      <ApplicationList title="待審核" rows={pending} showReview empty="目前沒有待審核申請。" />
      <ApplicationList title="已審核" rows={others} showReview={false} empty="尚無已審核紀錄。" />
    </section>
  );
}

function ApplicationList({
  title,
  rows,
  showReview,
  empty,
}: {
  title: string;
  rows: {
    id: string;
    email: string;
    name: string | null;
    requestedRole: string;
    note: string | null;
    status: string;
    reviewNote: string | null;
    createdAt: Date;
    reviewedAt: Date | null;
  }[];
  showReview: boolean;
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {rows.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-[var(--border)] bg-slate-50/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-[var(--muted)]">
                <span>
                  {maskEmail(a.email)}
                  {a.name ? `｜${a.name}` : ""}
                </span>
                <span>
                  {new Intl.DateTimeFormat("zh-TW", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(a.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm">
                申請角色：
                <span className="font-medium">{requestedRoleLabel(a.requestedRole)}</span>
                <span className="ml-3 text-[var(--muted)]">
                  狀態：{registrationStatusLabel(a.status)}
                </span>
              </p>
              {a.note ? (
                <p className="mt-1 text-sm text-[var(--muted)]">說明：{a.note}</p>
              ) : null}
              {a.reviewNote ? (
                <p className="mt-1 text-sm text-[var(--muted)]">審核備註：{a.reviewNote}</p>
              ) : null}
              {a.reviewedAt ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  審核時間：
                  {new Intl.DateTimeFormat("zh-TW", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(a.reviewedAt)}
                </p>
              ) : null}
              {/* 管理者審核時顯示完整信箱以便對照 Google 帳號 */}
              {showReview ? (
                <p className="mt-2 break-all text-xs text-[var(--muted)]">完整信箱：{a.email}</p>
              ) : null}
              {showReview ? <RegistrationReviewForm id={a.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
