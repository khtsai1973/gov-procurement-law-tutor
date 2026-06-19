import Link from "next/link";

import { getAppUrl, googleOAuthCallbackUrl } from "@/lib/app-url";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth-config";

export default async function GoogleOAuthSetupPage() {
  const configured = isGoogleOAuthConfigured();
  const appUrl = await getAppUrl();
  const callbackUrl = googleOAuthCallbackUrl(appUrl);
  const isLocal = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");

  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h1 className="text-xl font-semibold">設定 Google 登入</h1>

      {configured ? (
        <p className="mt-4 text-sm text-green-700">
          已偵測到有效的 GOOGLE_CLIENT_ID。請
          <Link href="/" className="mx-1 underline">
            返回首頁
          </Link>
          並按「以 Google 登入」。
        </p>
      ) : (
        <p className="mt-4 text-sm text-amber-800">
          目前環境變數尚未填入真實憑證（仍是占位字），因此無法登入。本機請編輯 <code>.env</code>；Vercel
          請至 Settings → Environment Variables。
        </p>
      )}

      <p className="mt-4 text-sm text-[var(--muted)]">
        目前站點 URL：<code className="rounded bg-gray-100 px-1">{appUrl}</code>
        {!isLocal ? (
          <span className="ml-1">（正式環境）</span>
        ) : (
          <span className="ml-1">（本機開發）</span>
        )}
      </p>

      <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm leading-relaxed">
        <li>
          開啟 Google Cloud 憑證頁（專案 <strong>government-procurement-act2</strong>）：
          <br />
          <a
            className="break-all underline"
            href="https://console.cloud.google.com/apis/credentials?project=government-procurement-act2"
            target="_blank"
            rel="noreferrer"
          >
            https://console.cloud.google.com/apis/credentials?project=government-procurement-act2
          </a>
        </li>
        <li>
          <strong>OAuth 同意畫面</strong>（必做，否則 AccessDenied）：
          <br />
          <a
            className="break-all underline"
            href="https://console.cloud.google.com/apis/credentials/consent?project=government-procurement-act2"
            target="_blank"
            rel="noreferrer"
          >
            開啟同意畫面設定
          </a>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>使用者類型：<strong>外部</strong></li>
            <li>
              <strong>測試中</strong>：到「測試使用者 → 新增使用者」加入允許登入的 Gmail
            </li>
            <li>
              <strong>公開網站</strong>：須發布為「正式版」（詳見 <code>GOOGLE-OAUTH.md</code>）
            </li>
          </ul>
        </li>
        <li>
          「建立憑證」→「OAuth 用戶端 ID」→ 類型選<strong>網頁應用程式</strong>
        </li>
        <li>
          填寫（本機與正式網域可<strong>同時</strong>列在多行）：
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              已授權的 JavaScript 來源：
              <code className="ml-1 block break-all rounded bg-gray-100 px-1">{appUrl}</code>
              {isLocal ? (
                <span className="text-xs text-[var(--muted)]">（正式部署另加 https://你的網域.vercel.app）</span>
              ) : (
                <span className="text-xs text-[var(--muted)]">
                  （本機開發另加 http://localhost:3000）
                </span>
              )}
            </li>
            <li>
              已授權的重新導向 URI（必須完全一致）：
              <code className="mt-1 block break-all rounded bg-gray-100 px-1">{callbackUrl}</code>
            </li>
          </ul>
        </li>
        <li>建立後複製「用戶端 ID」與「用戶端密鑰」到環境變數</li>
        <li>
          本機：編輯 <code>.env</code>；Vercel：Settings → Environment Variables
          <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
{`GOOGLE_CLIENT_ID="貼上.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="貼上密鑰"
NEXTAUTH_URL="${appUrl}"
AUTH_URL="${appUrl}"`}
          </pre>
        </li>
        <li>
          本機儲存後重啟 <code>npm run dev</code>；Vercel 變更 env 後需 Redeploy
        </li>
      </ol>

      <p className="mt-6 text-xs text-[var(--muted)]">
        詳細說明亦見 <code>GOOGLE-OAUTH.md</code>、<code>DEPLOY.md</code>。請勿將 Client Secret 提交到
        Git 或貼在公開場合。
      </p>

      <Link href="/" className="mt-6 inline-block text-sm underline">
        返回首頁
      </Link>
    </section>
  );
}
