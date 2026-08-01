/**
 * 個資顯示遮罩（老師／管理者介面）。
 * 完整信箱仍存於資料庫，僅降低畫面與日誌外洩風險。
 */

/** 遮罩 email：ab***@example.com */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "***";
  const keep = local.length <= 2 ? 1 : 2;
  const maskedLocal = `${local.slice(0, keep)}***`;
  return `${maskedLocal}@${domain}`;
}

/** 截斷過長個資／自由文字，避免日誌爆量 */
export function redactForLog(text: string | null | undefined, max = 80): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
