import { NextResponse } from "next/server";
import { z } from "zod";

import {
  gradeMockExamAnswer,
  inferMockExamQuestionType,
  parseReferenceAnswer,
} from "@/lib/mock-exam";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

const bodySchema = z.object({
  key: z.string().min(1),
  userAnswer: z.string().min(1).max(8),
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

  const item = await prisma.questionBankItem.findUnique({
    where: { key: parsed.data.key },
  });
  if (!item) {
    return NextResponse.json({ error: "找不到題目" }, { status: 404 });
  }

  const type = inferMockExamQuestionType(item);
  if (!type) {
    return NextResponse.json({ error: "此題目不適合模擬考試" }, { status: 400 });
  }

  const referenceAnswer = parseReferenceAnswer(item.hintAnswer, type);
  const isCorrect = gradeMockExamAnswer(parsed.data.userAnswer, referenceAnswer);

  const regulations = await prisma.regulation.findMany({
    where: { slug: { in: item.relatedSlugs } },
    select: { slug: true, title: true, sourceUrl: true },
  });

  const supplementRow = await prisma.mockExamSupplement.findUnique({
    where: {
      userId_itemKey: {
        userId: session.user.id,
        itemKey: item.key,
      },
    },
  });

  return NextResponse.json({
    key: item.key,
    referenceAnswer,
    isCorrect,
    hintAnswer: item.hintAnswer,
    regulations: regulations.map((r) => ({
      slug: r.slug,
      title: r.title,
      sourceUrl: r.sourceUrl,
    })),
    supplement: supplementRow?.supplement ?? null,
    sourceNote: supplementRow?.sourceNote ?? null,
  });
}
