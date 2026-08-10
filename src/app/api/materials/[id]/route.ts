import { NextResponse } from "next/server";

import { loadPublishedMaterialDetail } from "@/lib/materials-public";

export const runtime = "nodejs";
/** 單篇教材全文讀取；避免長時間佔用 serverless */
export const maxDuration = 15;

type Params = { params: Promise<{ id: string }> };

/** 學員／訪客：已發布教材全文（點選後載入） */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const materialId = id?.trim();
  if (!materialId) {
    return NextResponse.json({ error: "缺少教材 id" }, { status: 400 });
  }

  try {
    const detail = await loadPublishedMaterialDetail(materialId);
    if (!detail) {
      return NextResponse.json({ error: "找不到已發布教材" }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true, material: detail },
      {
        status: 200,
        headers: {
          // 公開教材可走 CDN／邊緣快取；發布後由 revalidateTag 失效
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "讀取教材失敗";
    console.error("[materials/detail]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
