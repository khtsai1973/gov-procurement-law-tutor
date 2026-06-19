function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** 從環境變數推斷站點根 URL（建置／背景工作） */
export function getAppUrlFromEnv(): string {
  const explicit = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

/** 依請求標頭推斷（自訂網域或 Vercel 預覽較準確） */
export async function getAppUrl(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() 僅在請求內可用
  }
  return getAppUrlFromEnv();
}

export function googleOAuthCallbackUrl(baseUrl: string): string {
  return `${stripTrailingSlash(baseUrl)}/api/auth/callback/google`;
}
