import { NextResponse } from "next/server";

import {
  buildMaterialDocx,
  buildMaterialPdf,
  documentFileName,
} from "@/lib/material-document";
import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function parseFormat(req: Request): "docx" | "pdf" | null {
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "").trim().toLowerCase();
  if (format === "docx" || format === "pdf") return format;
  return null;
}

/** 老師／管理者可下載教材文件（含草稿） */
export async function GET(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    return NextResponse.json({ error: "需要老師或管理者權限" }, { status: 401 });
  }

  const format = parseFormat(req);
  if (!format) {
    return NextResponse.json(
      { error: "請指定 format=docx 或 format=pdf" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const materialId = id?.trim();
  if (!materialId) {
    return NextResponse.json({ error: "缺少教材 id" }, { status: 400 });
  }

  try {
    await ensureTeacherSchema();
    const material = await prisma.unitMaterial.findUnique({ where: { id: materialId } });
    if (!material) {
      return NextResponse.json({ error: "找不到教材" }, { status: 404 });
    }

    const input = {
      title: material.title,
      category: material.category,
      unitCode: material.unitCode,
      summary: material.summary,
      content: material.content,
    };

    const buffer =
      format === "docx" ? await buildMaterialDocx(input) : await buildMaterialPdf(input);
    const filename = documentFileName(material, format);
    const encoded = encodeURIComponent(filename);
    const contentType =
      format === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="material.${format}"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "產生文件失敗";
    console.error("[materials/document/teacher]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
