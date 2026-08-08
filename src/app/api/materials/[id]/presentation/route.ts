import { NextResponse } from "next/server";

import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import {
  buildMaterialPptx,
  presentationFileName,
} from "@/lib/material-presentation";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** 學員可下載「已發布」教材簡報 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const materialId = id?.trim();
  if (!materialId) {
    return NextResponse.json({ error: "缺少教材 id" }, { status: 400 });
  }

  try {
    await ensureTeacherSchema();
    const material = await prisma.unitMaterial.findFirst({
      where: { id: materialId, published: true },
    });
    if (!material) {
      return NextResponse.json({ error: "找不到已發布教材" }, { status: 404 });
    }

    const buffer = await buildMaterialPptx({
      title: material.title,
      category: material.category,
      unitCode: material.unitCode,
      summary: material.summary,
      content: material.content,
    });

    const filename = presentationFileName(material);
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
    console.error("[materials/presentation/public]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
