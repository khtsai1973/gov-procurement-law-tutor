"use client";

import { useSession } from "next-auth/react";

/**
 * 頂部「單元教材」：
 * - 老師／管理者 → 單元教材首頁（列表）/teacher/materials
 * - 學員／訪客 → 學員閱讀頁 /materials
 * 使用 <a> 硬導覽，避免 App Router 軟導覽卡在編輯子頁。
 */
export function MaterialsNavLink() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isTeacher =
    status === "authenticated" && (role === "TEACHER" || role === "ADMIN");
  const href = isTeacher ? "/teacher/materials" : "/materials";

  return (
    <a href={href} className="nav-link">
      單元教材
    </a>
  );
}
