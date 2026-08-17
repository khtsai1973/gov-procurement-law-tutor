/**
 * 對外可索引的公開路徑（不含登入後／管理頁）。
 */

export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/regulations",
  "/question-bank",
  "/materials",
  "/mock-exam",
  "/scenario-essay",
  "/privacy",
  "/register",
] as const;

/** robots.txt 禁止爬取的路徑前綴 */
export const ROBOTS_DISALLOW_PATHS = [
  "/admin",
  "/teacher",
  "/dashboard",
  "/my-questions",
  "/auth/",
  "/api/",
  "/mock-exam/",
] as const;

export function absoluteUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  if (path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
