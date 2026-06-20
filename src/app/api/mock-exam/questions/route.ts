import { NextResponse } from "next/server";
import { z } from "zod";

import {
  inferMockExamQuestionType,
  mockExamTimeLimitSec,
  shuffleInPlace,
  toMockExamQuestionPayload,
} from "@/lib/mock-exam";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

const bodySchema = z.object({
  type: z.enum(["TRUE_FALSE", "MULTIPLE_CHOICE"]),
  count: z.union([z.literal(5), z.literal(10), z.literal(50)]),
  timedMode: z.boolean().optional().default(false),
  nickname: z.string().max(24).optional(),
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
    return NextResponse.json({ error: "參數格式不正確" }, { status: 400 });
  }

  const { type, count, timedMode, nickname: bodyNickname } = parsed.data;
  const allItems = await prisma.questionBankItem.findMany();
  const pool = allItems.filter((item) => inferMockExamQuestionType(item) === type);

  if (pool.length === 0) {
    return NextResponse.json(
      { error: type === "TRUE_FALSE" ? "題庫中尚無是非題" : "題庫中尚無選擇題" },
      { status: 404 },
    );
  }

  const take = Math.min(count, pool.length);
  const selected = shuffleInPlace([...pool]).slice(0, take);
  const questions = selected
    .map(toMockExamQuestionPayload)
    .filter((q): q is NonNullable<typeof q> => q !== null);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nickname: true, name: true },
  });

  const nickname = bodyNickname?.trim() || user?.nickname || user?.name || null;
  const timeLimitSec = mockExamTimeLimitSec(take, timedMode);

  const examSession = await prisma.mockExamSession.create({
    data: {
      userId: session.user.id,
      nickname,
      questionType: type,
      requestedCount: count,
      actualCount: questions.length,
      timedMode,
      timeLimitSec,
    },
  });

  return NextResponse.json({
    sessionId: examSession.id,
    questions,
    requested: count,
    actual: questions.length,
    totalInPool: pool.length,
    nickname,
    timedMode,
    timeLimitSec,
  });
}
