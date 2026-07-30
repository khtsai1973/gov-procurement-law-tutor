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

/** 依環境變數信箱清單決定角色；ADMIN 優先於 TEACHER */
export function resolveRoleFromEmail(email: string | null | undefined): Role {
  if (!email) return "USER";
  const e = email.toLowerCase();
  if (adminEmails.includes(e)) return "ADMIN";
  if (teacherEmails.includes(e)) return "TEACHER";
  return "USER";
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
    default:
      return "學員";
  }
}
