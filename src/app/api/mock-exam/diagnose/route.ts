import { NextResponse } from "next/server";
import { z } from "zod";

import { diagnoseMockExamSession } from "@/lib/exam-diagnostics";
import { getSession } from "@/lib/get-session";

export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().min(1),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
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
    const result = await diagnoseMockExamSession(session.user.id, parsed.data.sessionId, {
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
