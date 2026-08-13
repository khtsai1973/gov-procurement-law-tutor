import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin, requireUser } from "@/lib/authz";
import { listScenarioEssayQuestions } from "@/lib/scenario-essay-bank";
import { rateLimit } from "@/lib/rate-limit";

/** 列出情境申論題（不含評分焦點／示範大綱，避免劇透） */
export async function GET(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const authed = await requireUser();
  if (!authed.ok) return authed.response;

  const limited = rateLimit(`scenario-essay-list:${authed.user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "請求過於頻繁，請稍後再試" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  return NextResponse.json({ ok: true, questions: listScenarioEssayQuestions() });
}
