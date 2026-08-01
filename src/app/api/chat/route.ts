import { NextResponse } from "next/server";
import { z } from "zod";

import { generateGroundedAnswer } from "@/lib/answer";
import { assertSameOrigin, requireUser } from "@/lib/authz";
import { ensureKnowledgeBase } from "@/lib/bootstrap-knowledge";
import { ensureFeedbackSchema } from "@/lib/ensure-feedback-schema";
import { ensureRlsSchema } from "@/lib/ensure-rls-schema";
import { redactForLog } from "@/lib/pii";
import { sanitizeUserText } from "@/lib/prompt-injection";
import { rateLimit } from "@/lib/rate-limit";
import { retrieveForRag } from "@/lib/rag";
import { OFF_TOPIC_REPLY, isOnTopicQuestion } from "@/lib/topic-scope";
import { withUserRls } from "@/lib/with-user-rls";

const bodySchema = z
  .object({
    question: z.string().optional(),
    message: z.string().optional(),
  })
  .transform((data) => ({
    question: sanitizeUserText(data.question ?? data.message ?? ""),
  }))
  .pipe(
    z.object({
      question: z
        .string()
        .min(2, "請輸入至少 2 個字")
        .max(4000, "問題過長，請精簡後再試"),
    }),
  );

export async function POST(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const authed = await requireUser();
  if (!authed.ok) return authed.response;
  const userId = authed.user.id;

  const limited = rateLimit(`chat:${userId}`, { limit: 30, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "提問過於頻繁，請稍後再試" },
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
    return NextResponse.json({ error: "無法讀取請求內容" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "問題格式不正確";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const question = parsed.data.question;

  try {
    await Promise.all([ensureFeedbackSchema(), ensureRlsSchema()]);

    if (!isOnTopicQuestion(question)) {
      const row = await withUserRls(userId, (tx) =>
        tx.userQuestion.create({
          data: {
            userId,
            question,
            answer: OFF_TOPIC_REPLY,
            sources: JSON.stringify([]),
            answerModel: "off-topic",
            retrievalMode: "off-topic",
          },
        }),
      );
      return NextResponse.json({
        questionId: row.id,
        answer: OFF_TOPIC_REPLY,
        sources: [],
        model: "off-topic",
        retrievalMode: "off-topic",
      });
    }

    await ensureKnowledgeBase();
    const { chunks, mode: retrievalMode } = await retrieveForRag(question);
    const { answer, model, warning } = await generateGroundedAnswer(question, chunks);

    const sources: { title: string; tier: string; slug: string }[] = [];
    const seenSlug = new Set<string>();
    for (const c of chunks) {
      if (c.regulation.tier === "QUESTION_BANK") continue;
      if (seenSlug.has(c.regulation.slug)) continue;
      seenSlug.add(c.regulation.slug);
      sources.push({
        title: c.regulation.title,
        tier: c.regulation.tier,
        slug: c.regulation.slug,
      });
      if (sources.length >= 5) break;
    }

    const row = await withUserRls(userId, (tx) =>
      tx.userQuestion.create({
        data: {
          userId,
          question,
          answer,
          sources: JSON.stringify(sources),
          answerModel: model,
          retrievalMode,
        },
      }),
    );

    return NextResponse.json({
      questionId: row.id,
      answer,
      sources,
      model,
      warning,
      retrievalMode,
    });
  } catch (err) {
    console.error("[chat] unexpected error:", redactForLog(String(err), 200));
    return NextResponse.json(
      { error: "處理問題時發生錯誤，請稍後再試。" },
      { status: 500 },
    );
  }
}
