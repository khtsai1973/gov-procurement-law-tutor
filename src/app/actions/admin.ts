"use server";

import { revalidatePath } from "next/cache";

import { ingestCorpus } from "@/lib/ingest";
import { getSession } from "@/lib/get-session";

export async function runKnowledgeIngest() {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { ok: false as const, error: "需要管理者權限" };
  }

  try {
    const result = await ingestCorpus(session.user.email ?? session.user.id);
    revalidatePath("/admin");
    return { ok: true as const, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "ingest failed";
    return { ok: false as const, error: message };
  }
}
