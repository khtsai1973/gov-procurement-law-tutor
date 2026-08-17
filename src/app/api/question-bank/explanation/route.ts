import { NextResponse } from "next/server";

import { loadQuestionBankExplanation } from "@/lib/question-bank-public";

export const runtime = "nodejs";
export const maxDuration = 15;

/** 單題解析：列表點開後才載入，避免首屏塞入完整 hintAnswer */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key")?.trim() ?? "";
  if (!key) {
    return NextResponse.json({ error: "缺少題目鍵值" }, { status: 400 });
  }

  try {
    const explanation = await loadQuestionBankExplanation(key);
    if (!explanation) {
      return NextResponse.json({ error: "找不到題目解析" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, explanation },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "解析讀取失敗";
    console.error("[question-bank/explanation]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
