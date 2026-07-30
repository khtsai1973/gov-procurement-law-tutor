import { NextResponse } from "next/server";

import { replaceQuestionBankFromDisk } from "@/lib/import-question-bank";
import { clearQuestionBankCache } from "@/lib/question-bank";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function hasStaleOrEmptyQuestionBank(): Promise<boolean> {
  const count = await prisma.questionBankItem.count();
  if (count === 0) return true;
  const groups = await prisma.questionBankItem.groupBy({ by: ["category"] });
  if (groups.length !== 14) return true;
  const stale = await prisma.questionBankItem.findFirst({
    where: {
      OR: [
        { category: { startsWith: "第 " } },
        { category: { startsWith: "第" } },
        { category: "未分類章節" },
        { category: "金額門檻" },
        { category: "最有利標" },
        { category: "招標期限" },
        { category: "議價比減" },
        { category: "未達公告金額" },
        { category: "採購人員倫理" },
      ],
    },
    select: { id: true },
  });
  return Boolean(stale);
}

/**
 * POST /api/admin/reimport-question-bank
 * - ADMIN session 或 Bearer QUESTION_BANK_REIMPORT_SECRET：可 force
 * - 題庫為空／含舊分類時：允許公開一次性重匯
 */
export async function POST(req: Request) {
  const session = await getSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const secret = process.env.QUESTION_BANK_REIMPORT_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const secretOk = Boolean(secret && bearer && bearer === secret);
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const needsMigrate = await hasStaleOrEmptyQuestionBank();

  if (force && !isAdmin && !secretOk) {
    return NextResponse.json({ error: "強制重匯需要管理者權限" }, { status: 401 });
  }
  if (!isAdmin && !secretOk && !needsMigrate) {
    return NextResponse.json({ error: "需要管理者權限" }, { status: 401 });
  }

  try {
    const before = await prisma.questionBankItem.count();
    const result = await replaceQuestionBankFromDisk(
      prisma,
      force ? "api-force-replace" : "api-stale-replace",
    );
    clearQuestionBankCache();
    return NextResponse.json({
      ok: true,
      mode: force ? "force" : "stale-replace",
      before,
      deleted: result.deleted,
      imported: result.imported,
      categories: result.synced?.categories ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "reimport failed";
    console.error("[reimport-question-bank]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cats = await prisma.questionBankItem.groupBy({
      by: ["category"],
      _count: { _all: true },
      orderBy: { category: "asc" },
    });
    return NextResponse.json({
      count: cats.reduce((s, c) => s + c._count._all, 0),
      categories: cats.map((c) => ({ name: c.category, count: c._count._all })),
      staleOrEmpty: await hasStaleOrEmptyQuestionBank(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "status failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
