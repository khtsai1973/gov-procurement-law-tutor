import { NextResponse } from "next/server";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import {
  buildMaterialPptx,
  normalizeSlides,
  presentationFileName,
} from "@/lib/material-presentation";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

async function requireTeacherSession() {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    return null;
  }
  return session;
}

function pptxResponse(buffer: ArrayBuffer, filename: string) {
  const encoded = encodeURIComponent(filename);
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="material.pptx"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * GET：不再直接給老師一鍵下載（避免未排版就輸出）。
 * 請改走排版頁後以 POST 匯出。
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await requireTeacherSession();
  if (!session) {
    return NextResponse.json({ error: "需要老師或管理者權限" }, { status: 401 });
  }

  const { id } = await params;
  return NextResponse.json(
    {
      error: "請先至簡報排版頁調整後再匯出",
      layoutUrl: `/teacher/materials/${id}/presentation`,
    },
    { status: 405 },
  );
}

/** POST：以老師排版後的投影片匯出 PPTX */
export async function POST(req: Request, { params }: Params) {
  const session = await requireTeacherSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "需要老師或管理者權限" }, { status: 401 });
  }

  const { id } = await params;
  const materialId = id?.trim();
  if (!materialId) {
    return NextResponse.json({ error: "缺少教材 id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請提供排版後的投影片 JSON" }, { status: 400 });
  }

  const slides = normalizeSlides(
    body && typeof body === "object" ? (body as { slides?: unknown }).slides : null,
  );
  if (!slides) {
    return NextResponse.json({ error: "投影片資料不正確或為空" }, { status: 400 });
  }

  try {
    await ensureTeacherSchema();
    const material = await prisma.unitMaterial.findUnique({ where: { id: materialId } });
    if (!material) {
      return NextResponse.json({ error: "找不到教材" }, { status: 404 });
    }

    const buffer = await buildMaterialPptx(
      {
        title: material.title,
        category: material.category,
        unitCode: material.unitCode,
        summary: material.summary,
        content: material.content,
      },
      { slides },
    );

    return pptxResponse(buffer, presentationFileName(material));
  } catch (e) {
    const message = e instanceof Error ? e.message : "產生簡報失敗";
    console.error("[materials/presentation]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
