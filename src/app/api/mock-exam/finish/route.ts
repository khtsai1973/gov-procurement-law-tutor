import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin, requireUser } from "@/lib/authz";
import {
  gradeMockExamAnswer,
  inferMockExamQuestionType,
  parseReferenceAnswer,
} from "@/lib/mock-exam";
import { resolveQuestionExplanation } from "@/lib/question-bank-explanations";
import { rateLimit } from "@/lib/rate-limit";
import prisma from "@/lib/prisma";
import { withUserRls } from "@/lib/with-user-rls";

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
  answers: z.array(answerSchema).min(1).max(200),
});

export async function POST(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const authed = await requireUser();
  if (!authed.ok) return authed.response;
  const userId = authed.user.id;

  const limited = rateLimit(`mock-finish:${userId}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "操作過於頻繁，請稍後再試" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
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

  const examSession = await withUserRls(userId, (tx) =>
    tx.mockExamSession.findFirst({
      where: { id: parsed.data.sessionId, userId },
    }),
  );
  if (!examSession) {
    return NextResponse.json({ error: "找不到測驗場次" }, { status: 404 });
  }
  if (examSession.finishedAt) {
    return NextResponse.json({ ok: true, alreadyFinished: true });
  }

  // 伺服器端重新評分，不信任客戶端 isCorrect / referenceAnswer
  const keys = [...new Set(parsed.data.answers.map((a) => a.itemKey))];
  const items = await prisma.questionBankItem.findMany({
    where: { key: { in: keys } },
    select: { key: true, question: true, hintAnswer: true },
  });
  const itemMap = new Map(items.map((i) => [i.key, i]));

  let answeredCount = 0;
  let correctCount = 0;
  let gradableCount = 0;

  const answerRows = parsed.data.answers.map((a) => {
    const hasAnswer = !!a.userAnswer?.trim();
    if (hasAnswer) answeredCount++;

    const item = itemMap.get(a.itemKey);
    const type = item ? inferMockExamQuestionType(item) : null;
    const resolvedHint = item
      ? resolveQuestionExplanation({
          key: item.key,
          hintAnswer: item.hintAnswer,
        }).hintAnswer
      : null;
    const referenceAnswer =
      item && type ? parseReferenceAnswer(resolvedHint, type) : null;
    const isCorrect =
      hasAnswer && referenceAnswer
        ? gradeMockExamAnswer(a.userAnswer!.trim(), referenceAnswer)
        : null;

    if (isCorrect === true) correctCount++;
    if (isCorrect !== null) gradableCount++;

    return {
      sessionId: examSession.id,
      itemKey: a.itemKey,
      questionIndex: a.questionIndex,
      userAnswer: a.userAnswer?.trim() || null,
      referenceAnswer,
      isCorrect,
      revealed: a.revealed,
      sourceNote: a.sourceNote?.trim() || null,
    };
  });

  await withUserRls(userId, async (tx) => {
    await tx.mockExamSessionAnswer.deleteMany({ where: { sessionId: examSession.id } });
    await tx.mockExamSessionAnswer.createMany({ data: answerRows });
    await tx.mockExamSession.update({
      where: { id: examSession.id },
      data: {
        elapsedSec: parsed.data.elapsedSec,
        answeredCount,
        correctCount,
        gradableCount,
        finishedAt: new Date(),
      },
    });
  });

  return NextResponse.json({
    ok: true,
    answeredCount,
    correctCount,
    gradableCount,
    elapsedSec: parsed.data.elapsedSec,
  });
}
