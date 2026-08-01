import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin, requireUser } from "@/lib/authz";
import { ensureFeedbackSchema } from "@/lib/ensure-feedback-schema";
import { sanitizeUserText } from "@/lib/prompt-injection";
import { rateLimit } from "@/lib/rate-limit";
import { withUserRls } from "@/lib/with-user-rls";

const bodySchema = z.object({
  questionId: z.string().min(1, "缺少提問編號"),
  feedback: z.enum(["UP", "DOWN"], {
    errorMap: () => ({ message: "請選擇滿意或不滿意" }),
  }),
  comment: z
    .string()
    .max(1000, "回饋文字請精簡於 1000 字內")
    .optional()
    .transform((v) => sanitizeUserText(v ?? "", 1000) || null),
});

export async function POST(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const authed = await requireUser();
  if (!authed.ok) return authed.response;
  const userId = authed.user.id;

  const limited = rateLimit(`feedback:${userId}`, { limit: 60, windowMs: 60_000 });
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

  const updated = await withUserRls(userId, async (tx) => {
    const row = await tx.userQuestion.findFirst({
      where: { id: questionId, userId },
      select: { id: true },
    });
    if (!row) return null;
    return tx.userQuestion.update({
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
  });

  if (!updated) {
    return NextResponse.json({ error: "找不到對應的提問紀錄" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    questionId: updated.id,
    feedback: updated.feedback,
    comment: updated.feedbackComment,
    feedbackAt: updated.feedbackAt,
  });
}
