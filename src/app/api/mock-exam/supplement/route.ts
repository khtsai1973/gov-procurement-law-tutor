import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

const bodySchema = z
  .object({
    key: z.string().min(1),
    supplement: z.string().max(2000).optional(),
    sourceNote: z.string().max(500).optional(),
  })
  .refine((data) => !!(data.supplement?.trim() || data.sourceNote?.trim()), {
    message: "請至少填寫補充說明或解答來源註記",
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
    const msg = parsed.error.issues[0]?.message;
    return NextResponse.json(
      { error: msg ?? "補充內容格式不正確" },
      { status: 400 },
    );
  }

  const item = await prisma.questionBankItem.findUnique({
    where: { key: parsed.data.key },
    select: { key: true },
  });
  if (!item) {
    return NextResponse.json({ error: "找不到題目" }, { status: 404 });
  }

  const supplement = parsed.data.supplement?.trim() ?? "";
  const sourceNote = parsed.data.sourceNote?.trim() ?? "";

  const existing = await prisma.mockExamSupplement.findUnique({
    where: {
      userId_itemKey: {
        userId: session.user.id,
        itemKey: parsed.data.key,
      },
    },
  });

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
      supplement: supplement || sourceNote,
      sourceNote: sourceNote || null,
    },
    update: {
      ...(parsed.data.supplement !== undefined ? { supplement: supplement || existing?.supplement || sourceNote } : {}),
      ...(parsed.data.sourceNote !== undefined ? { sourceNote: sourceNote || null } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    supplement: row.supplement,
    sourceNote: row.sourceNote,
  });
}
