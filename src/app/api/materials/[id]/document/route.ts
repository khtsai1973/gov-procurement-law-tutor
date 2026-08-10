import { NextResponse } from "next/server";

import {
  buildMaterialDocx,
  buildMaterialPdf,
  documentFileName,
} from "@/lib/material-document";
import { ensureTeacherSchema } from "@/lib/ensure-teacher-schema";
import { buildMaterialInfoFields } from "@/lib/material-info";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function parseFormat(req: Request): "docx" | "pdf" | null {
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "").trim().toLowerCase();
  if (format === "docx" || format === "pdf") return format;
  return null;
}

/** 學員可下載「已發布」教材文件（DOCX / PDF） */
export async function GET(req: Request, { params }: Params) {
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
    const material = await prisma.unitMaterial.findFirst({
      where: { id: materialId, published: true },
    });
    if (!material) {
      return NextResponse.json({ error: "找不到已發布教材" }, { status: 404 });
    }

    const nameIds = [material.reviewedById, material.lastRevisionById].filter(
      (x): x is string => Boolean(x),
    );
    const users =
      nameIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: nameIds } },
            select: { id: true, name: true, nickname: true, email: true },
          })
        : [];
    const nameById = new Map(
      users.map(
        (u) =>
          [u.id, u.nickname ?? u.name ?? u.email ?? u.id] as const,
      ),
    );

    const input = {
      title: material.title,
      category: material.category,
      unitCode: material.unitCode,
      summary: material.summary,
      content: material.content,
      info: buildMaterialInfoFields({
        source: material.source,
        createdAt: material.createdAt,
        aiGeneratedAt: material.aiGeneratedAt,
        reviewedAt: material.reviewedAt,
        regulationVersion: material.regulationVersion,
        lastRevisionAt: material.lastRevisionAt,
        lastRevisionNote: material.lastRevisionNote,
        reviewerName: material.reviewedById
          ? (nameById.get(material.reviewedById) ?? material.reviewedById)
          : null,
        lastRevisionByName: material.lastRevisionById
          ? (nameById.get(material.lastRevisionById) ?? material.lastRevisionById)
          : null,
      }),
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
    console.error("[materials/document/public]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
