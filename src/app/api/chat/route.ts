import { NextResponse } from "next/server";
import { z } from "zod";

import { generateGroundedAnswer } from "@/lib/answer";
import { ensureKnowledgeBase } from "@/lib/bootstrap-knowledge";
import prisma from "@/lib/prisma";
import { retrieveForRag } from "@/lib/rag";
import { matchQuestionBank } from "@/lib/question-bank";
import { getSession } from "@/lib/get-session";

const bodySchema = z
  .object({
    question: z.string().optional(),
    message: z.string().optional(),
  })
  .transform((data) => ({
    question: (data.question ?? data.message ?? "").trim(),
  }))
  .pipe(
    z.object({
      question: z
        .string()
        .min(2, "請輸入至少 2 個字")
        .max(4000, "問題過長，請精簡後再試"),
    }),
  );

async function resolveUserId(session: {
  user?: { id?: string; email?: string | null };
}) {
  if (session.user?.id) return session.user.id;
  if (!session.user?.email) return null;
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return dbUser?.id ?? null;
}

export async function POST(req: Request) {
  const session = await getSession();
  const userId = session ? await resolveUserId(session) : null;

  if (!userId) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "無法讀取請求內容" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "問題格式不正確";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const question = parsed.data.question;

  try {
    await ensureKnowledgeBase();
    const { chunks, mode: retrievalMode, questionBankUsed } = await retrieveForRag(question);
    const bankMatch = questionBankUsed ? await matchQuestionBank(question) : null;
    const { answer, model, warning } = await generateGroundedAnswer(question, chunks, {
      questionBankHint: bankMatch?.hintAnswer,
    });

    const sources: { title: string; tier: string; slug: string }[] = [];
    const seenSlug = new Set<string>();
    for (const c of chunks) {
      if (seenSlug.has(c.regulation.slug)) continue;
      seenSlug.add(c.regulation.slug);
      sources.push({
        title: c.regulation.title,
        tier: c.regulation.tier,
        slug: c.regulation.slug,
      });
      if (sources.length >= 5) break;
    }

    await prisma.userQuestion.create({
      data: {
        userId,
        question,
        answer,
        sources: JSON.stringify(sources),
      },
    });

    return NextResponse.json({ answer, sources, model, warning, retrievalMode });
  } catch (err) {
    console.error("[chat] unexpected error:", err);
    return NextResponse.json(
      { error: "處理問題時發生錯誤，請稍後再試。" },
      { status: 500 },
    );
  }
}
