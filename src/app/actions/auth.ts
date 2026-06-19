"use server";

import { redirect } from "next/navigation";

import { isGoogleOAuthConfigured } from "@/lib/google-oauth-config";
import { signIn, signOut } from "@/auth";

export async function loginWithGoogle() {
  if (!isGoogleOAuthConfigured()) {
    redirect("/auth/error?error=GoogleNotConfigured");
  }
  await signIn("google", { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
