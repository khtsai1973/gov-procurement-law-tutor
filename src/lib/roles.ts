import type { Role } from "@prisma/client";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** 專案預設老師信箱（與 TEACHER_EMAILS 合併；ADMIN 仍優先） */
const BUILTIN_TEACHER_EMAILS = ["sports20140906@gmail.com"];

const teacherEmails = [
  ...BUILTIN_TEACHER_EMAILS,
  ...(process.env.TEACHER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
];

/** 管理者可指派的角色群組 */
export const ASSIGNABLE_ROLES = ["USER", "TEACHER", "ADMIN"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(role: string): role is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/** 依環境變數信箱清單決定角色；ADMIN 優先於 TEACHER */
export function resolveRoleFromEmail(email: string | null | undefined): Role {
  if (!email) return "USER";
  const e = email.toLowerCase();
  if (adminEmails.includes(e)) return "ADMIN";
  if (teacherEmails.includes(e)) return "TEACHER";
  return "USER";
}

/**
 * 既有帳號登入時是否要以白名單覆寫 DB 角色。
 * - ADMIN_EMAILS：強制維持管理者（開機／救援用）
 * - TEACHER_EMAILS：不覆寫，改由管理者在後台調整並持久化
 */
export function shouldForceAllowlistRoleOnLogin(
  allowlistRole: Role,
): allowlistRole is "ADMIN" {
  return allowlistRole === "ADMIN";
}

export function isAdminRole(role: Role | string | undefined | null): boolean {
  return role === "ADMIN";
}

/** 老師或管理者皆可使用教學功能 */
export function canAccessTeacher(role: Role | string | undefined | null): boolean {
  return role === "TEACHER" || role === "ADMIN";
}

export function roleLabel(role: Role | string | undefined | null): string {
  switch (role) {
    case "ADMIN":
      return "管理者";
    case "TEACHER":
      return "老師";
    case "USER":
      return "學員";
    default:
      return "學員";
  }
}

/** 純函式：檢查角色變更是否允許（供 action 與測試共用） */
export function validateUserRoleChange(input: {
  actorUserId: string;
  targetUserId: string;
  currentRole: Role | string;
  nextRole: Role | string;
  adminCount: number;
}): { ok: true } | { ok: false; error: string } {
  if (!isAssignableRole(input.nextRole)) {
    return { ok: false, error: "無效的角色" };
  }
  if (input.currentRole === input.nextRole) {
    return { ok: false, error: "角色未變更" };
  }
  if (input.actorUserId === input.targetUserId) {
    return { ok: false, error: "不可調整自己的角色，請請其他管理者代為調整" };
  }
  if (
    input.currentRole === "ADMIN" &&
    input.nextRole !== "ADMIN" &&
    input.adminCount <= 1
  ) {
    return { ok: false, error: "系統至少需保留一位管理者" };
  }
  return { ok: true };
}
