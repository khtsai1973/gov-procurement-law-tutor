import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/teacher", "/my-questions"];

function hasSessionCookie(req: NextRequest): boolean {
  return Boolean(
    req.cookies.get("__Secure-authjs.session-token")?.value ||
      req.cookies.get("authjs.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value ||
      req.cookies.get("next-auth.session-token")?.value,
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 變更類 API：同站 Origin 檢查（Bearer 密鑰呼叫除外）
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
  ) {
    const auth = req.headers.get("authorization") ?? "";
    const origin = req.headers.get("origin");
    if (origin && !auth.startsWith("Bearer ")) {
      try {
        if (new URL(origin).host !== req.nextUrl.host) {
          return NextResponse.json({ error: "非法來源請求" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "非法來源請求" }, { status: 403 });
      }
    }
  }

  // 受保護頁面：無 session cookie 時導回首頁（頁面內仍有角色驗證）
  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!hasSessionCookie(req)) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  return res;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/teacher/:path*",
    "/my-questions/:path*",
    "/api/:path*",
  ],
};
