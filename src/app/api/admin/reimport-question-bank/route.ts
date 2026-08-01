import { NextResponse } from "next/server";

import { assertSameOrigin, requireAdmin } from "@/lib/authz";
import { replaceQuestionBankFromDisk } from "@/lib/import-question-bank";
import { clearQuestionBankCache } from "@/lib/question-bank";
import { getSession } from "@/lib/get-session";
import { rateLimit } from "@/lib/rate-limit";
import prisma from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
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

function secretAuthorized(req: Request): boolean {
  const secret = process.env.QUESTION_BANK_REIMPORT_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return Boolean(secret && bearer && bearer === secret);
}

/**
 * POST /api/admin/reimport-question-bank
 * 僅 ADMIN session 或 Bearer QUESTION_BANK_REIMPORT_SECRET
 */
export async function POST(req: Request) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const secretOk = secretAuthorized(req);
  if (!secretOk) {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
  }

  const limited = rateLimit("admin-reimport", { limit: 5, windowMs: 300_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "重匯過於頻繁，請稍後再試" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  try {
    const before = await prisma.questionBankItem.count();
    const result = await replaceQuestionBankFromDisk(
      prisma,
      force ? "api-force-replace" : "api-stale-replace",
    );
    clearQuestionBankCache();
    return NextResponse.json({
      ok: true,
      mode: force ? "force" : "replace",
      before,
      deleted: result.deleted,
      imported: result.imported,
      categories: result.synced?.categories ?? null,
      staleOrEmpty: await hasStaleOrEmptyQuestionBank(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "reimport failed";
    console.error("[reimport-question-bank]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** GET：僅管理者或密鑰可查詢題庫狀態 */
export async function GET(req: Request) {
  const secretOk = secretAuthorized(req);
  if (!secretOk) {
    const session = await getSession();
    if (!session?.user?.id || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: "需要管理者權限" }, { status: 401 });
    }
  }

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
