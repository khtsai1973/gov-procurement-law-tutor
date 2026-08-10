import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin, requireUser } from "@/lib/authz";
import { diagnoseQuestionWrongReason } from "@/lib/question-wrong-reason";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const bodySchema = z.object({
  itemKey: z.string().min(1).max(200),
  userAnswer: z.string().min(1).max(20),
});

/** 題庫練習：AI 錯題原因／弱點提示 */
export async function POST(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const authed = await requireUser();
  if (!authed.ok) return authed.response;
  const userId = authed.user.id;

  const limited = rateLimit(`qb-wrong-reason:${userId}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "分析請求過於頻繁，請稍後再試" },
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

  try {
    const result = await diagnoseQuestionWrongReason(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[question-bank/diagnose-wrong]", e);
    return NextResponse.json({ error: "錯題原因分析失敗，請稍後再試" }, { status: 500 });
  }
}
