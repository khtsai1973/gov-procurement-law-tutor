import { NextResponse } from "next/server";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { getSession } from "@/lib/get-session";
import {
  buildMaterialPptx,
  presentationFileName,
} from "@/lib/material-presentation";
import prisma from "@/lib/prisma";
import { canAccessTeacher } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session?.user?.id || !canAccessTeacher(session.user.role)) {
    return NextResponse.json({ error: "需要老師或管理者權限" }, { status: 401 });
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

    const buffer = await buildMaterialPptx({
      title: material.title,
      category: material.category,
      unitCode: material.unitCode,
      summary: material.summary,
      content: material.content,
    });

    const filename = presentationFileName(material);
    // RFC 5987 for Chinese filenames
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "產生簡報失敗";
    console.error("[materials/presentation]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
