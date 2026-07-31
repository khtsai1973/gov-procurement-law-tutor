import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureMockExamGuidanceSchema } from "@/lib/ensure-mock-exam-guidance-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

const bodySchema = z.object({
  key: z.string().min(1),
  askNote: z.string().max(1000).optional(),
  supplement: z.string().max(2000).optional(),
  sourceNote: z.string().max(500).optional(),
});

/** 學員：請老師指導 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  await ensureMockExamGuidanceSchema();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "無法讀取請求" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數格式不正確" }, { status: 400 });
  }

  const item = await prisma.questionBankItem.findUnique({
    where: { key: parsed.data.key },
    select: { key: true },
  });
  if (!item) {
    return NextResponse.json({ error: "找不到題目" }, { status: 404 });
  }

  const askNote = parsed.data.askNote?.trim() || null;
  const supplement = parsed.data.supplement?.trim() ?? "";
  const sourceNote = parsed.data.sourceNote?.trim() || null;

  const existing = await prisma.mockExamSupplement.findUnique({
    where: {
      userId_itemKey: { userId: session.user.id, itemKey: parsed.data.key },
    },
  });

  const row = await prisma.mockExamSupplement.upsert({
    where: {
      userId_itemKey: { userId: session.user.id, itemKey: parsed.data.key },
    },
    create: {
      userId: session.user.id,
      itemKey: parsed.data.key,
      supplement: supplement || sourceNote || askNote || "（請老師指導）",
      sourceNote,
      guidanceAskNote: askNote,
      guidanceRequestedAt: new Date(),
      // 重新提問時清空舊回覆
      teacherGuidance: null,
      guidanceRepliedAt: null,
      guidanceByUserId: null,
    },
    update: {
      ...(supplement ? { supplement } : {}),
      ...(parsed.data.sourceNote !== undefined ? { sourceNote } : {}),
      guidanceAskNote: askNote ?? existing?.guidanceAskNote ?? null,
      guidanceRequestedAt: new Date(),
      teacherGuidance: null,
      guidanceRepliedAt: null,
      guidanceByUserId: null,
    },
  });

  return NextResponse.json({
    ok: true,
    guidanceRequestedAt: row.guidanceRequestedAt?.toISOString() ?? null,
    teacherGuidance: row.teacherGuidance,
    guidanceAskNote: row.guidanceAskNote,
  });
}
