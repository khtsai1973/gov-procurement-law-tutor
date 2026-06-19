import Link from "next/link";

import { getAppUrl, googleOAuthCallbackUrl } from "@/lib/app-url";

const hints: Record<string, string> = {
  GoogleNotConfigured:
    "尚未設定有效的 Google OAuth 憑證。請至 Google Cloud 建立 OAuth 用戶端並寫入環境變數，詳見 /auth/setup。",
  DatabaseNotReady:
    "Google 已驗證成功，但資料庫尚未建立 User 資料表。請對 DATABASE_URL 指向的 Postgres 執行 db:init（見 DEPLOY.md），完成後再登入。",
  Configuration: "伺服器設定有誤。請檢查 AUTH_SECRET / NEXTAUTH_SECRET 與 Google 憑證。",
  AccessDenied:
    "Google 拒絕登入。若 OAuth 仍為「測試中」，僅測試使用者清單內的 Gmail 可登入；公開使用須發布為「正式版」（見 GOOGLE-OAUTH.md）。",
  Verification: "登入驗證失敗，請再試一次。",
  Default: "登入時發生錯誤。",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const code = error ?? "Default";
  const message = hints[code] ?? hints.Default;
  const isAccessDenied = code === "AccessDenied";
  const isDatabase = code === "DatabaseNotReady";
  const appUrl = await getAppUrl();
  const callbackUrl = googleOAuthCallbackUrl(appUrl);

  return (
    <section className="mx-auto max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h1 className="text-xl font-semibold">登入錯誤</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">錯誤代碼：{code}</p>
      <p className="mt-4 text-sm leading-relaxed">{message}</p>

      {isDatabase ? (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
{`# 設定 DATABASE_URL 後執行（本機或 Neon 皆可）
npm run db:init
npm run corpus:rag-init   # 選填，語意檢索需 embedding`}
        </pre>
      ) : null}

      {isAccessDenied ? (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            開啟 OAuth 同意畫面：{" "}
            <a
              className="break-all underline"
              href="https://console.cloud.google.com/auth/audience?project=government-procurement-act2"
              target="_blank"
              rel="noreferrer"
            >
              測試使用者／發布狀態
            </a>
          </li>
          <li>
            <strong>測試中</strong>：按 <strong>+ Add users</strong> 加入登入用的 Gmail（須完全相同）
          </li>
          <li>
            <strong>公開使用</strong>：將發布狀態改為「正式版」（見 <code>GOOGLE-OAUTH.md</code>）
          </li>
          <li>儲存後等 1～2 分鐘</li>
          <li>
            用無痕視窗開{" "}
            <a className="break-all underline" href={appUrl}>
              {appUrl}
            </a>
            ，登入時選正確 Gmail 並按「繼續／允許」
          </li>
        </ol>
      ) : (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
          <li>
            重新導向 URI（須與 Google Cloud 完全一致）：
            <code className="mt-1 block break-all rounded bg-gray-100 px-1">{callbackUrl}</code>
          </li>
          <li>
            站點 URL（<code>NEXTAUTH_URL</code> / <code>AUTH_URL</code>）：
            <code className="mt-1 block break-all rounded bg-gray-100 px-1">{appUrl}</code>
          </li>
          <li>
            <Link href="/auth/setup" className="underline">
              Google OAuth 設定說明
            </Link>
          </li>
        </ul>
      )}

      <Link href="/" className="mt-6 inline-block text-sm underline">
        返回首頁
      </Link>
    </section>
  );
}
