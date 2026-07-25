import { z } from "zod";

import { streamGroundedAnswer } from "@/lib/answer";
import { ensureKnowledgeBase } from "@/lib/bootstrap-knowledge";
import { buildChatCitations } from "@/lib/chat-citations";
import type { ChatCitation } from "@/lib/chat-types";
import { ensureFeedbackSchema } from "@/lib/ensure-feedback-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { matchQuestionBank } from "@/lib/question-bank";
import { retrieveForRag } from "@/lib/rag";
import { OFF_TOPIC_REPLY, isOnTopicQuestion } from "@/lib/topic-scope";

export const maxDuration = 60;

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

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const session = await getSession();
  const userId = session ? await resolveUserId(session) : null;

  if (!userId) {
    return new Response(JSON.stringify({ error: "請先登入" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "無法讀取請求內容" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "問題格式不正確";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const question = parsed.data.question;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      try {
        await ensureFeedbackSchema();

        if (!isOnTopicQuestion(question)) {
          const row = await prisma.userQuestion.create({
            data: {
              userId,
              question,
              answer: OFF_TOPIC_REPLY,
              sources: JSON.stringify([]),
              answerModel: "off-topic",
              retrievalMode: "off-topic",
            },
          });
          send("meta", {
            questionId: row.id,
            sources: [] as ChatCitation[],
            retrievalMode: "off-topic",
            model: "off-topic",
          });
          send("token", { text: OFF_TOPIC_REPLY });
          send("done", { answer: OFF_TOPIC_REPLY, model: "off-topic" });
          controller.close();
          return;
        }

        await ensureKnowledgeBase();
        const { chunks, mode: retrievalMode, questionBankUsed } = await retrieveForRag(question);
        const bankMatch = questionBankUsed ? await matchQuestionBank(question) : null;
        const sources = buildChatCitations(chunks);

        const row = await prisma.userQuestion.create({
          data: {
            userId,
            question,
            answer: null,
            sources: JSON.stringify(sources),
            answerModel: null,
            retrievalMode,
          },
        });

        send("meta", {
          questionId: row.id,
          sources,
          retrievalMode,
        });

        let finalAnswer = "";
        let finalModel = "unknown";
        let warning: string | undefined;

        for await (const ev of streamGroundedAnswer(question, chunks, {
          questionBankHint: bankMatch?.hintAnswer,
        })) {
          if (ev.type === "token") {
            send("token", { text: ev.text });
          } else if (ev.type === "done") {
            finalAnswer = ev.answer;
            finalModel = ev.model;
            warning = ev.warning;
          }
        }

        await prisma.userQuestion.update({
          where: { id: row.id },
          data: {
            answer: finalAnswer,
            answerModel: finalModel,
            sources: JSON.stringify(sources),
          },
        });

        send("done", {
          answer: finalAnswer,
          model: finalModel,
          warning,
          retrievalMode,
        });
        controller.close();
      } catch (err) {
        console.error("[chat] stream error:", err);
        send("error", { error: "處理問題時發生錯誤，請稍後再試。" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
