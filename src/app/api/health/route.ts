import { NextResponse } from "next/server";

/**
 * 輕量健康檢查／暖機端點。不連 DB，供 cron 或 ttfb:check 預熱 serverless。
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { ok: true, ts: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
