import { NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher, isAdminRole } from "@/lib/roles";

export type AuthedUser = {
  id: string;
  email: string | null;
  role: string;
};

/** 解析 session 中的使用者 id（必要時以 email 回查） */
export async function resolveSessionUserId(session: {
  user?: { id?: string; email?: string | null };
}): Promise<string | null> {
  if (session.user?.id) return session.user.id;
  if (!session.user?.email) return null;
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return dbUser?.id ?? null;
}

export async function requireUser(): Promise<
  { ok: true; user: AuthedUser } | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  const id = session ? await resolveSessionUserId(session) : null;
  if (!id || !session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "請先登入" }, { status: 401 }),
    };
  }
  return {
    ok: true,
    user: {
      id,
      email: session.user.email ?? null,
      role: session.user.role ?? "USER",
    },
  };
}

export async function requireTeacher(): Promise<
  { ok: true; user: AuthedUser } | { ok: false; response: NextResponse }
> {
  const authed = await requireUser();
  if (!authed.ok) return authed;
  if (!canAccessTeacher(authed.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "需要老師權限" }, { status: 403 }),
    };
  }
  return authed;
}

export async function requireAdmin(): Promise<
  { ok: true; user: AuthedUser } | { ok: false; response: NextResponse }
> {
  const authed = await requireUser();
  if (!authed.ok) return authed;
  if (!isAdminRole(authed.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "需要管理者權限" }, { status: 403 }),
    };
  }
  return authed;
}

/**
 * 瀏覽器發起的變更請求應帶同站 Origin，降低 CSRF 風險。
 * 允許無 Origin（同源 form／部分客戶端）或 Bearer 密鑰呼叫。
 */
export function assertSameOrigin(req: Request): NextResponse | null {
  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;

  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return null;

  const origin = req.headers.get("origin");
  if (!origin) return null;

  try {
    const reqUrl = new URL(req.url);
    const originUrl = new URL(origin);
    if (originUrl.host !== reqUrl.host) {
      return NextResponse.json({ error: "非法來源請求" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "非法來源請求" }, { status: 403 });
  }
  return null;
}
