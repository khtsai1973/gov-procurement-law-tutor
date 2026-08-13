import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin, requireUser } from "@/lib/authz";
import { gradeScenarioEssay } from "@/lib/scenario-essay-grade";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const bodySchema = z.object({
  questionId: z.string().min(1).max(120),
  userAnswer: z.string().min(20).max(6000),
});

/** 情境申論題 Rubric AI 批改 */
export async function POST(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const authed = await requireUser();
  if (!authed.ok) return authed.response;
  const userId = authed.user.id;

  const limited = rateLimit(`scenario-essay-grade:${userId}`, {
    limit: 8,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "批改請求過於頻繁，請稍後再試" },
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
    return NextResponse.json(
      { error: "參數格式不正確（作答須 20～6000 字）" },
      { status: 400 },
    );
  }

  try {
    const result = await gradeScenarioEssay(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[scenario-essay/grade]", e);
    return NextResponse.json({ error: "批改失敗，請稍後再試" }, { status: 500 });
  }
}
