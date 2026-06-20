import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Role } from "@prisma/client";

import prisma from "@/lib/prisma";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

import { getGoogleOAuthConfig, isGoogleOAuthConfigured } from "@/lib/google-oauth-config";

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

      const role: Role = adminEmails.includes(user.email.toLowerCase())
        ? "ADMIN"
        : "USER";

      try {
        await prisma.user.upsert({
          where: { email: user.email },
          create: {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            emailVerified: new Date(),
            role,
          },
          update: {
            name: user.name ?? null,
            image: user.image ?? null,
            role,
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[auth] signIn 寫入資料庫失敗（常見：Postgres 未啟動或未 db:push）:", msg);
        return "/auth/error?error=DatabaseNotReady";
      }

      return true;
    },
    async jwt({ token, user }) {
      try {
        if (user?.email) {
          const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
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
            const dbUser = await prisma.user.findUnique({
              where: { email: session.user.email },
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
