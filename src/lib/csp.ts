/**
 * Content-Security-Policy 組裝。
 *
 * 不可對 ISR／靜態頁使用 per-request nonce：nonce 會迫使動態渲染，
 * 且預渲染的 inline script 沒有對應 nonce，上線會被擋。
 *
 * 收緊步驟：
 * 1. 正式環境移除 script-src 'unsafe-eval'（React 除錯才需要，且僅限 development）
 * 2. script-src-attr 'none'：unsafe-inline 不再涵蓋 onclick 等屬性（CSP3）
 * 3. 樣式仍允許 unsafe-inline（next/font 的 <style>、React style 屬性）
 */

export type CspOptions = {
  /** 預設依 NODE_ENV；development 才加 unsafe-eval */
  isDev?: boolean;
};

export function isCspDevelopment(options?: CspOptions): boolean {
  if (typeof options?.isDev === "boolean") return options.isDev;
  return process.env.NODE_ENV !== "production";
}

export function buildContentSecurityPolicy(options?: CspOptions): string {
  const isDev = isCspDevelopment(options);
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    scriptSrc,
    // CSP3：縮小 unsafe-inline，禁止 inline event handler（onclick=…）
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
