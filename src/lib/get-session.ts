import type { Session } from "next-auth";

import { auth } from "@/auth";

/**
 * 讀取登入狀態。若瀏覽器內 JWT 與目前 AUTH_SECRET 不符（或 Cookie 損壞），
 * 會視為未登入，避免 JWTSessionError 導致整頁崩潰。
 */
function isDatabaseUnreachable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Can't reach database") ||
    msg.includes("P1001") ||
    msg.includes("ECONNREFUSED")
  );
}

export async function getSession(): Promise<Session | null> {
  try {
    return await auth();
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      console.warn(
        "[auth] 資料庫未連線（請啟動 Docker Postgres：`docker compose up -d`，再執行 `npm run db:init`；或改設 Neon 的 DATABASE_URL）",
      );
      return null;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[auth] 無法解密工作階段（請清除本站 Cookie 後重新登入）:",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
}
