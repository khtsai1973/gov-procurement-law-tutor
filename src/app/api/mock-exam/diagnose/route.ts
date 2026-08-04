import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin, requireUser } from "@/lib/authz";
import { diagnoseMockExamSession } from "@/lib/exam-diagnostics";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().min(1),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const authed = await requireUser();
  if (!authed.ok) return authed.response;
  const userId = authed.user.id;

  const limited = rateLimit(`mock-diagnose:${userId}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "診斷請求過於頻繁，請稍後再試" },
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
    const result = await diagnoseMockExamSession(userId, parsed.data.sessionId, {
      force: parsed.data.force,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_NOT_FOUND") {
      return NextResponse.json({ error: "找不到測驗場次" }, { status: 404 });
    }
    console.error("[mock-exam/diagnose]", e);
    return NextResponse.json({ error: "錯題診斷失敗，請稍後再試" }, { status: 500 });
  }
}
