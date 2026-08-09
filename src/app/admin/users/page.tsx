import Link from "next/link";
import { redirect } from "next/navigation";

import { UserRoleForm } from "@/components/UserRoleForm";
import { getSession } from "@/lib/get-session";
import { maskEmail } from "@/lib/pii";
import prisma from "@/lib/prisma";
import { isAdminRole, roleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      nickname: true,
      role: true,
      emailVerified: true,
    },
    take: 200,
  });

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">使用者角色管理</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              調整既有帳號的角色群組（學員／老師／管理者）。不可變更自己的角色；系統至少保留一位管理者。
            </p>
          </div>
          <Link href="/admin" className="text-sm no-underline hover:underline">
            ← 管理者首頁
          </Link>
        </div>
        <p className="mt-4 text-sm">
          共 <span className="font-semibold">{users.length}</span> 位使用者
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        {users.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">尚無使用者。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">帳號</th>
                  <th className="py-2 pr-3 font-medium">目前角色</th>
                  <th className="py-2 font-medium">調整</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === session.user.id;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-[var(--border)] last:border-b-0 align-top"
                    >
                      <td className="py-3 pr-3">
                        <div className="font-medium">
                          {u.nickname ?? u.name ?? "（未設定暱稱）"}
                          {isSelf ? (
                            <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                              （你）
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 break-all text-xs text-[var(--muted)]">
                          {u.email ? maskEmail(u.email) : "（無信箱）"}
                        </div>
                        {u.email && !isSelf ? (
                          <div className="mt-0.5 break-all text-xs text-[var(--muted)]">
                            完整：{u.email}
                          </div>
                        ) : null}
                        {u.emailVerified ? (
                          <div className="mt-0.5 text-xs text-[var(--muted)]">
                            驗證：
                            {new Intl.DateTimeFormat("zh-TW", {
                              dateStyle: "medium",
                            }).format(u.emailVerified)}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3">{roleLabel(u.role)}</td>
                      <td className="py-3">
                        <UserRoleForm
                          userId={u.id}
                          currentRole={u.role}
                          disabled={isSelf}
                        />
                        {isSelf ? (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            自己的角色請由其他管理者調整
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
