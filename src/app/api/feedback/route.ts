import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureFeedbackSchema } from "@/lib/ensure-feedback-schema";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

const bodySchema = z.object({
  questionId: z.string().min(1, "缺少提問編號"),
  feedback: z.enum(["UP", "DOWN"], {
    errorMap: () => ({ message: "請選擇滿意或不滿意" }),
  }),
  comment: z
    .string()
    .max(1000, "回饋文字請精簡於 1000 字內")
    .optional()
    .transform((v) => (v ?? "").trim() || null),
});

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
    const msg = parsed.error.errors[0]?.message ?? "回饋格式不正確";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { questionId, feedback, comment } = parsed.data;

  try {
    await ensureFeedbackSchema();
  } catch (err) {
    console.error("[feedback] schema ensure failed:", err);
    return NextResponse.json(
      { error: "資料庫尚未就緒，請稍後再試或執行 npm run db:push。" },
      { status: 503 },
    );
  }

  const row = await prisma.userQuestion.findFirst({
    where: { id: questionId, userId },
    select: { id: true },
  });

  if (!row) {
    return NextResponse.json({ error: "找不到對應的提問紀錄" }, { status: 404 });
  }

  const updated = await prisma.userQuestion.update({
    where: { id: questionId },
    data: {
      feedback,
      feedbackComment: comment,
      feedbackAt: new Date(),
    },
    select: {
      id: true,
      feedback: true,
      feedbackComment: true,
      feedbackAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    questionId: updated.id,
    feedback: updated.feedback,
    comment: updated.feedbackComment,
    feedbackAt: updated.feedbackAt,
  });
}
