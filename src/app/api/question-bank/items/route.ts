import { NextResponse } from "next/server";

import {
  loadQuestionBankPage,
  parseQuestionBankListQuery,
} from "@/lib/question-bank-public";

export const runtime = "nodejs";
export const maxDuration = 15;

/** 公開題庫分頁列表（不含解析正文） */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = parseQuestionBankListQuery({
    category: url.searchParams.get("category"),
    q: url.searchParams.get("q"),
    important: url.searchParams.get("important"),
    page: url.searchParams.get("page"),
  });

  try {
    const result = await loadQuestionBankPage(query);
    return NextResponse.json(
      { ok: true, ...result },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "題庫讀取失敗";
    console.error("[question-bank/items]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
