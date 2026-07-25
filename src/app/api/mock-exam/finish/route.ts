import { NextResponse } from "next/server";
import { z } from "zod";

import {
  gradeMockExamAnswer,
  inferMockExamQuestionType,
  parseReferenceAnswer,
} from "@/lib/mock-exam";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

const answerSchema = z.object({
  itemKey: z.string().min(1),
  questionIndex: z.number().int().min(0),
  userAnswer: z.string().max(8).optional().nullable(),
  referenceAnswer: z.string().max(16).optional().nullable(),
  isCorrect: z.boolean().nullable().optional(),
  revealed: z.boolean(),
  sourceNote: z.string().max(500).optional().nullable(),
});

const bodySchema = z.object({
  sessionId: z.string().min(1),
  elapsedSec: z.number().int().min(0).max(86400),
  answers: z.array(answerSchema).min(1),
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

  const examSession = await prisma.mockExamSession.findFirst({
    where: { id: parsed.data.sessionId, userId: session.user.id },
  });
  if (!examSession) {
    return NextResponse.json({ error: "找不到測驗場次" }, { status: 404 });
  }
  if (examSession.finishedAt) {
    return NextResponse.json({ ok: true, alreadyFinished: true });
  }

  const bankItems = await prisma.questionBankItem.findMany({
    where: { key: { in: parsed.data.answers.map((a) => a.itemKey) } },
    select: { key: true, hintAnswer: true, question: true },
  });
  const bankMap = new Map(bankItems.map((i) => [i.key, i]));

  let answeredCount = 0;
  let correctCount = 0;
  let gradableCount = 0;

  const answerRows = parsed.data.answers.map((a) => {
    const hasAnswer = !!a.userAnswer?.trim();
    if (hasAnswer) answeredCount++;

    const bank = bankMap.get(a.itemKey);
    const type = bank ? inferMockExamQuestionType(bank) : null;
    const serverRef =
      bank && type ? parseReferenceAnswer(bank.hintAnswer, type) : a.referenceAnswer ?? null;
    const referenceAnswer = a.referenceAnswer ?? serverRef;
    const serverGrade =
      hasAnswer && referenceAnswer
        ? gradeMockExamAnswer(a.userAnswer!.trim(), referenceAnswer)
        : null;
    const isCorrect = serverGrade ?? a.isCorrect ?? null;
    // 交卷視為完成評分：有作答且可評分者計入成績
    const revealed = a.revealed || (hasAnswer && isCorrect !== null);

    if (isCorrect === true) correctCount++;
    if (isCorrect !== null) gradableCount++;

    return {
      sessionId: examSession.id,
      itemKey: a.itemKey,
      questionIndex: a.questionIndex,
      userAnswer: a.userAnswer?.trim() || null,
      referenceAnswer,
      isCorrect,
      revealed,
      sourceNote: a.sourceNote?.trim() || null,
    };
  });

  await prisma.$transaction([
    prisma.mockExamSessionAnswer.deleteMany({ where: { sessionId: examSession.id } }),
    prisma.mockExamSessionAnswer.createMany({ data: answerRows }),
    prisma.mockExamSession.update({
      where: { id: examSession.id },
      data: {
        elapsedSec: parsed.data.elapsedSec,
        answeredCount,
        correctCount,
        gradableCount,
        finishedAt: new Date(),
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    answeredCount,
    correctCount,
    gradableCount,
    elapsedSec: parsed.data.elapsedSec,
    wrongCount: answerRows.filter((a) => a.isCorrect === false).length,
  });
}
