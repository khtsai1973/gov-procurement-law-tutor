import { NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { loadUserQuestionBankWeakness } from "@/lib/question-bank-weakness";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  try {
    const weakness = await loadUserQuestionBankWeakness(session.user.id);
    return NextResponse.json({ weakness });
  } catch (e) {
    console.error("[question-bank/weakness] load failed:", e);
    return NextResponse.json({ error: "弱點分析載入失敗" }, { status: 500 });
  }
}
