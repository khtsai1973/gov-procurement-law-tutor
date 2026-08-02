"use server";

import { revalidatePath } from "next/cache";

import { ensureRegistrationSchema } from "@/lib/ensure-registration-schema";
import { getSession } from "@/lib/get-session";
import { sanitizeUserText } from "@/lib/prompt-injection";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  isRequestableRole,
  normalizeEmail,
  type RequestableRole,
} from "@/lib/registration";
import { isAdminRole } from "@/lib/roles";

export async function submitRegistrationApplication(formData: FormData) {
  await ensureRegistrationSchema();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const name = sanitizeUserText(String(formData.get("name") ?? ""), 80) || null;
  const note = sanitizeUserText(String(formData.get("note") ?? ""), 500) || null;
  const roleRaw = String(formData.get("requestedRole") ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "請填寫有效的電子郵件" };
  }
  if (!isRequestableRole(roleRaw)) {
    return { ok: false as const, error: "請選擇老師或一般使用者角色" };
  }
  const requestedRole: RequestableRole = roleRaw;

  const limited = rateLimit(`register:${email}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!limited.ok) {
    return { ok: false as const, error: "申請過於頻繁，請稍後再試" };
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) {
    return {
      ok: false as const,
      error: "此信箱已有帳號，請直接以 Google 登入",
    };
  }

  const existing = await prisma.registrationApplication.findUnique({
    where: { email },
  });

  if (existing?.status === "APPROVED") {
    return {
      ok: false as const,
      error: "此信箱已核准，請以相同 Google 帳號登入",
    };
  }
  if (existing?.status === "PENDING") {
    return {
      ok: false as const,
      error: "此信箱已有待審核申請，請等候管理者審核",
    };
  }

  if (existing?.status === "REJECTED") {
    await prisma.registrationApplication.update({
      where: { email },
      data: {
        name,
        requestedRole,
        note,
        status: "PENDING",
        reviewedAt: null,
        reviewedById: null,
        reviewNote: null,
      },
    });
  } else {
    await prisma.registrationApplication.create({
      data: {
        email,
        name,
        requestedRole,
        note,
        status: "PENDING",
      },
    });
  }

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
  return {
    ok: true as const,
    message: "已送出申請，請等候管理者審核；核准後再以同一 Google 帳號登入。",
  };
}

export async function reviewRegistrationApplication(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    return { ok: false as const, error: "需要管理者權限" };
  }

  await ensureRegistrationSchema();

  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const reviewNote =
    sanitizeUserText(String(formData.get("reviewNote") ?? ""), 500) || null;

  if (!id) return { ok: false as const, error: "缺少申請編號" };
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return { ok: false as const, error: "無效的審核決定" };
  }

  const row = await prisma.registrationApplication.findUnique({ where: { id } });
  if (!row) return { ok: false as const, error: "找不到申請" };
  if (row.status !== "PENDING") {
    return { ok: false as const, error: "此申請已審核過" };
  }

  await prisma.registrationApplication.update({
    where: { id },
    data: {
      status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewedAt: new Date(),
      reviewedById: session.user.id,
      reviewNote,
    },
  });

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
  return {
    ok: true as const,
    message: decision === "APPROVE" ? "已核准加入" : "已拒絕申請",
  };
}
