import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Role } from "@prisma/client";

import { ensureRegistrationSchema } from "@/lib/ensure-registration-schema";
import { getGoogleOAuthConfig, isGoogleOAuthConfigured } from "@/lib/google-oauth-config";
import prisma from "@/lib/prisma";
import { normalizeEmail } from "@/lib/registration";
import { resolveRoleFromEmail, shouldForceAllowlistRoleOnLogin } from "@/lib/roles";

const { clientId, clientSecret } = getGoogleOAuthConfig();
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

if (!authSecret) {
  console.error(
    "[auth] 缺少 AUTH_SECRET 或 NEXTAUTH_SECRET" +
      (process.env.NODE_ENV === "production" ? "（正式環境必須在 Vercel 設定）" : ""),
  );
}
if (process.env.NODE_ENV === "development" && !isGoogleOAuthConfigured()) {
  console.error(
    "[auth] .env 仍為占位字或未設定 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET（見 GOOGLE-OAUTH.md）",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret,
  debug: process.env.AUTH_DEBUG === "true",
  providers: [
    Google({
      clientId,
      clientSecret,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const emailNorm = normalizeEmail(user.email);
      const allowlistRole = resolveRoleFromEmail(user.email);

      try {
        await ensureRegistrationSchema();

        const existing = await prisma.user.findFirst({
          where: { email: { equals: user.email, mode: "insensitive" } },
        });

        // 環境變數白名單：管理者／老師可直接登入（免註冊審核）
        if (allowlistRole === "ADMIN" || allowlistRole === "TEACHER") {
          if (existing) {
            await prisma.user.update({
              where: { id: existing.id },
              data: {
                name: user.name ?? existing.name,
                image: user.image ?? existing.image,
                emailVerified: new Date(),
                // ADMIN_EMAILS 強制維持管理者；其餘保留 DB 角色（可由管理者後台調整）
                ...(shouldForceAllowlistRoleOnLogin(allowlistRole)
                  ? { role: allowlistRole }
                  : {}),
              },
            });
          } else {
            await prisma.user.create({
              data: {
                email: user.email,
                name: user.name ?? null,
                image: user.image ?? null,
                emailVerified: new Date(),
                role: allowlistRole,
              },
            });
          }
          return true;
        }

        // 既有帳號：允許登入並保留既有角色（不因未在白名單而被降權）
        if (existing) {
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              name: user.name ?? existing.name,
              image: user.image ?? existing.image,
              emailVerified: new Date(),
            },
          });
          return true;
        }

        // 新訪客：須有已核准的註冊申請
        const application = await prisma.registrationApplication.findUnique({
          where: { email: emailNorm },
        });
        if (!application || application.status !== "APPROVED") {
          return "/register?error=not-approved";
        }

        const role: Role =
          application.requestedRole === "TEACHER" ? "TEACHER" : "USER";

        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name ?? application.name ?? null,
            image: user.image ?? null,
            emailVerified: new Date(),
            role,
          },
        });
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[auth] signIn 寫入資料庫失敗（常見：Postgres 未啟動或未 db:push）:", msg);
        return "/auth/error?error=DatabaseNotReady";
      }
    },
    async jwt({ token, user }) {
      try {
        if (user?.email) {
          const dbUser = await prisma.user.findFirst({
            where: { email: { equals: user.email, mode: "insensitive" } },
          });
          if (dbUser) {
            token.sub = dbUser.id;
            token.role = dbUser.role;
            token.nickname = dbUser.nickname;
          }
        } else if (token.sub) {
          const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
          if (dbUser) {
            token.role = dbUser.role;
            token.nickname = dbUser.nickname;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[auth] jwt callback db error:", msg);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        let userId = token.sub ?? "";
        try {
          if (!userId && session.user.email) {
            const dbUser = await prisma.user.findFirst({
              where: { email: { equals: session.user.email, mode: "insensitive" } },
              select: { id: true, role: true, nickname: true },
            });
            userId = dbUser?.id ?? "";
            if (dbUser) {
              token.role = dbUser.role;
              token.nickname = dbUser.nickname;
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn("[auth] session callback db error:", msg);
        }
        session.user.id = userId;
        session.user.role = (token.role as Role | undefined) ?? "USER";
        session.user.nickname = (token.nickname as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
