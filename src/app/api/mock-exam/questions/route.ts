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
  /** 題庫分類複選；空陣列或未傳＝全部類別 */
  categories: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
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
  const selectedCategories = [
    ...new Set((parsed.data.categories ?? []).map((c) => c.trim()).filter(Boolean)),
  ];

  const allItems = await prisma.questionBankItem.findMany({
    where: selectedCategories.length > 0 ? { category: { in: selectedCategories } } : undefined,
  });
  const pool = allItems.filter((item) => inferMockExamQuestionType(item) === type);

  if (pool.length === 0) {
    const typeLabel = type === "TRUE_FALSE" ? "是非題" : "選擇題";
    const error =
      selectedCategories.length > 0
        ? `所選類別中尚無可用的${typeLabel}`
        : `題庫中尚無${typeLabel}`;
    return NextResponse.json({ error }, { status: 404 });
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
    categories: selectedCategories,
    nickname,
    timedMode,
    timeLimitSec,
  });
}
