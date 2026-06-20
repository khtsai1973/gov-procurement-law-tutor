"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { NICKNAME_PRESETS } from "@/lib/mock-exam";

export async function updateNickname(nickname: string) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: "請先登入" };
  }

  const trimmed = nickname.trim();
  if (trimmed.length < 1 || trimmed.length > 24) {
    return { error: "暱稱請介於 1～24 字" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { nickname: trimmed },
  });

  revalidatePath("/mock-exam");
  revalidatePath("/");
  return { ok: true, nickname: trimmed };
}

export async function getNicknamePresets() {
  return [...NICKNAME_PRESETS];
}
