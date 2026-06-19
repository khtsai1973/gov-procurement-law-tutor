import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

/** 資料表尚未建立時回傳 false（需執行 npm run db:push） */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.regulation.count();
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.message.includes("does not exist"))
    ) {
      return false;
    }
    throw error;
  }
}
