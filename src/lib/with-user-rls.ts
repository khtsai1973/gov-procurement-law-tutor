import type { Prisma } from "@prisma/client";

import { ensureRlsSchema } from "@/lib/ensure-rls-schema";
import prisma from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

/**
 * 在交易內設定 app.current_user_id，讓 RLS 政策生效。
 * 用於學員自身資料讀寫。
 */
export async function withUserRls<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  await ensureRlsSchema();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'off', true)`;
    return fn(tx);
  });
}

/**
 * 老師／管理者跨使用者查詢或維運時暫時略過 RLS。
 */
export async function withRlsBypass<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  await ensureRlsSchema();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
    return fn(tx);
  });
}
