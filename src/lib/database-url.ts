/**
 * Serverless／Neon：為 DATABASE_URL 補上較安全的連線參數（不覆寫既有設定）。
 * - connect_timeout：避免冷啟動時長時間掛起
 * - connection_limit：Vercel 函式內限制連線數，減輕 DB 連線耗盡
 */
export function withServerlessDbParams(rawUrl: string | undefined): string | undefined {
  if (!rawUrl?.trim()) return rawUrl;
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "10");
    }
    if (!url.searchParams.has("connection_limit") && !url.searchParams.has("pgbouncer")) {
      url.searchParams.set("connection_limit", "5");
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}
