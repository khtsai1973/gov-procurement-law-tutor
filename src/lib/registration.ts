import type { RegistrationStatus, Role } from "@prisma/client";

import { resolveRoleFromEmail } from "@/lib/roles";

export type RequestableRole = Extract<Role, "USER" | "TEACHER">;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isRequestableRole(role: string): role is RequestableRole {
  return role === "USER" || role === "TEACHER";
}

export function registrationStatusLabel(status: RegistrationStatus | string): string {
  switch (status) {
    case "PENDING":
      return "待審核";
    case "APPROVED":
      return "已核准";
    case "REJECTED":
      return "已拒絕";
    default:
      return String(status);
  }
}

export function requestedRoleLabel(role: Role | string): string {
  switch (role) {
    case "TEACHER":
      return "老師";
    case "USER":
      return "一般使用者";
    default:
      return String(role);
  }
}

/** 環境變數白名單（管理者／內建老師）可略過申請直接登入 */
export function isAllowlistedEmail(email: string | null | undefined): boolean {
  const role = resolveRoleFromEmail(email);
  return role === "ADMIN" || role === "TEACHER";
}
