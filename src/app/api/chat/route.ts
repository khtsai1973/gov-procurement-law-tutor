import { NextResponse } from "next/server";
import { z } from "zod";

import { generateGroundedAnswer } from "@/lib/answer";
import { assertSameOrigin, requireUser } from "@/lib/authz";
import { ensureKnowledgeBase } from "@/lib/bootstrap-knowledge";
import {
  chunkTextForStream,
  createChatSseResponse,
  encodeSse,
  type ChatStreamEvent,
} from "@/lib/chat-stream";
import { classifyInput, sanitizeUserText } from "@/lib/defense";
import { ensureFeedbackSchema } from "@/lib/ensure-feedback-schema";
import { ensureRlsSchema } from "@/lib/ensure-rls-schema";
import { redactForLog } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { retrieveForRag } from "@/lib/rag";
import { OFF_TOPIC_REPLY, isOnTopicQuestion } from "@/lib/topic-scope";
import { withUserRls } from "@/lib/with-user-rls";

const bodySchema = z
  .object({
    question: z.string().optional(),
    message: z.string().optional(),
    stream: z.boolean().optional(),
  })
  .transform((data) => ({
    question: sanitizeUserText(data.question ?? data.message ?? ""),
    stream: Boolean(data.stream),
  }))
  .pipe(
    z.object({
      question: z
        .string()
        .min(2, "請輸入至少 2 個字")
        .max(4000, "問題過長，請精簡後再試"),
      stream: z.boolean(),
    }),
  );

type SourceRow = { title: string; tier: string; slug: string };

function collectSources(
  chunks: Awaited<ReturnType<typeof retrieveForRag>>["chunks"],
): SourceRow[] {
  const sources: SourceRow[] = [];
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
  return sources;
}

function wantsStream(req: Request, bodyStream: boolean): boolean {
  if (bodyStream) return true;
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/event-stream");
}

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
  const stream = wantsStream(req, parsed.data.stream);

  // 輸入層（Serverless）：與 Edge middleware 雙重把關
  const inputVerdict = classifyInput(question);
  if (!inputVerdict.allowed) {
    try {
      await Promise.all([ensureFeedbackSchema(), ensureRlsSchema()]);
      const row = await withUserRls(userId, (tx) =>
        tx.userQuestion.create({
          data: {
            userId,
            question,
            answer: OFF_TOPIC_REPLY,
            sources: JSON.stringify([]),
            answerModel: "prompt-injection-blocked",
            retrievalMode: "input-guard",
          },
        }),
      );
      const payload = {
        questionId: row.id,
        answer: OFF_TOPIC_REPLY,
        sources: [] as SourceRow[],
        model: "prompt-injection-blocked",
        retrievalMode: "input-guard",
        defense: "input-layer",
      };
      if (stream) {
        return createChatSseResponse(
          sseFromFinal(payload.answer, {
            questionId: payload.questionId,
            sources: payload.sources,
            model: payload.model,
            retrievalMode: payload.retrievalMode,
            defense: payload.defense,
          }),
        );
      }
      return NextResponse.json(payload);
    } catch (err) {
      console.error("[chat] input-guard persist error:", redactForLog(String(err), 200));
      return NextResponse.json(
        {
          answer: OFF_TOPIC_REPLY,
          sources: [],
          model: "prompt-injection-blocked",
          defense: "input-layer",
        },
        { status: 400 },
      );
    }
  }

  if (stream) {
    return createChatSseResponse(ssePipeline(userId, question));
  }

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
        defense: "input-layer",
      });
    }

    await ensureKnowledgeBase();
    const { chunks, mode: retrievalMode } = await retrieveForRag(question);
    const { answer, model, warning, defense } = await generateGroundedAnswer(
      question,
      chunks,
    );
    const sources = collectSources(chunks);

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
      defense,
    });
  } catch (err) {
    console.error("[chat] unexpected error:", redactForLog(String(err), 200));
    return NextResponse.json(
      { error: "處理問題時發生錯誤，請稍後再試。" },
      { status: 500 },
    );
  }
}

function sseFromFinal(
  answer: string,
  done: Omit<Extract<ChatStreamEvent, { type: "done" }>, "type">,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse({ type: "status", stage: "generate" })));
      for (const part of chunkTextForStream(answer)) {
        controller.enqueue(encoder.encode(encodeSse({ type: "delta", text: part })));
      }
      controller.enqueue(encoder.encode(encodeSse({ type: "done", ...done })));
      controller.close();
    },
  });
}

function ssePipeline(userId: string, question: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(encodeSse(event)));
      };
      try {
        send({ type: "status", stage: "retrieve" });
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
          send({ type: "status", stage: "generate" });
          for (const part of chunkTextForStream(OFF_TOPIC_REPLY)) {
            send({ type: "delta", text: part });
          }
          send({
            type: "done",
            questionId: row.id,
            sources: [],
            model: "off-topic",
            retrievalMode: "off-topic",
            defense: "input-layer",
          });
          controller.close();
          return;
        }

        await ensureKnowledgeBase();
        const { chunks, mode: retrievalMode } = await retrieveForRag(question);
        send({ type: "status", stage: "generate" });
        const { answer, model, warning, defense } = await generateGroundedAnswer(
          question,
          chunks,
        );
        const sources = collectSources(chunks);

        for (const part of chunkTextForStream(answer)) {
          send({ type: "delta", text: part });
        }

        send({ type: "status", stage: "persist" });
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

        send({
          type: "done",
          questionId: row.id,
          sources,
          model,
          warning,
          retrievalMode,
          defense,
        });
        controller.close();
      } catch (err) {
        console.error("[chat/stream] error:", redactForLog(String(err), 200));
        send({ type: "error", error: "處理問題時發生錯誤，請稍後再試。" });
        controller.close();
      }
    },
  });
}
