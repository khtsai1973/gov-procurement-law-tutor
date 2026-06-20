import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

const bodySchema = z.object({
  key: z.string().min(1),
  supplement: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "無法讀取請求" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "補充內容請介於 1～2000 字" }, { status: 400 });
  }

  const item = await prisma.questionBankItem.findUnique({
    where: { key: parsed.data.key },
    select: { key: true },
  });
  if (!item) {
    return NextResponse.json({ error: "找不到題目" }, { status: 404 });
  }

  const row = await prisma.mockExamSupplement.upsert({
    where: {
      userId_itemKey: {
        userId: session.user.id,
        itemKey: parsed.data.key,
      },
    },
    create: {
      userId: session.user.id,
      itemKey: parsed.data.key,
      supplement: parsed.data.supplement.trim(),
    },
    update: {
      supplement: parsed.data.supplement.trim(),
    },
  });

  return NextResponse.json({ ok: true, supplement: row.supplement });
}
