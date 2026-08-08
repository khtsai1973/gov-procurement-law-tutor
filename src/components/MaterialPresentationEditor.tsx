"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import type { MaterialSlide } from "@/lib/material-presentation";

type Props = {
  materialId: string;
  materialTitle: string;
  initialSlides: MaterialSlide[];
  listHref?: string;
};

function emptySlide(): MaterialSlide {
  return { title: "新投影片", bullets: [""], paragraphs: [] };
}

export function MaterialPresentationEditor({
  materialId,
  materialTitle,
  initialSlides,
  listHref = "/teacher/materials",
}: Props) {
  const [slides, setSlides] = useState<MaterialSlide[]>(() =>
    initialSlides.length > 0 ? initialSlides : [emptySlide()],
  );
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = slides[active] ?? slides[0]!;
  const previewBullets = useMemo(
    () => current.bullets.filter((b) => b.trim()),
    [current.bullets],
  );
  const previewParas = useMemo(
    () => current.paragraphs.filter((p) => p.trim()),
    [current.paragraphs],
  );

  function updateSlide(index: number, patch: Partial<MaterialSlide>) {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function moveSlide(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= slides.length) return;
    setSlides((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item!);
      return copy;
    });
    setActive(next);
  }

  function removeSlide(index: number) {
    if (slides.length <= 1) return;
    if (!window.confirm("刪除此投影片？")) return;
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setActive((a) => Math.max(0, Math.min(a, slides.length - 2)));
  }

  function addSlide(after = active) {
    setSlides((prev) => {
      const copy = [...prev];
      copy.splice(after + 1, 0, emptySlide());
      return copy;
    });
    setActive(after + 1);
  }

  function exportPptx() {
    setError(null);
    startTransition(async () => {
      const cleaned = slides
        .map((s) => ({
          title: s.title.trim(),
          bullets: s.bullets.map((b) => b.trim()).filter(Boolean),
          paragraphs: s.paragraphs.map((p) => p.trim()).filter(Boolean),
        }))
        .filter((s) => s.title || s.bullets.length || s.paragraphs.length);

      if (cleaned.length === 0) {
        setError("請至少保留一張有內容的投影片");
        return;
      }

      const res = await fetch(`/api/teacher/materials/${materialId}/presentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides: cleaned }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "匯出失敗");
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const filename = utfMatch
        ? decodeURIComponent(utfMatch[1]!)
        : `${materialTitle || "單元教材"}.pptx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">簡報排版</p>
          <h1 className="mt-1 text-xl font-semibold">{materialTitle}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            請先調整投影片標題與條列，確認預覽後再匯出 PPTX（不會直接輸出未排版檔案）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={listHref} className="font-medium no-underline hover:underline">
            ← 返回單元教材首頁
          </Link>
          <Link
            href={`/teacher/materials?edit=${materialId}`}
            className="no-underline hover:underline"
          >
            編輯教材本文
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[14rem_1fr_18rem]">
        {/* 投影片清單 */}
        <aside className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--muted)]">投影片（{slides.length}）</p>
            <button
              type="button"
              onClick={() => addSlide(slides.length - 1)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              新增
            </button>
          </div>
          <ol className="max-h-[28rem] space-y-1 overflow-y-auto">
            {slides.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                    active === i
                      ? "border-blue-300 bg-blue-50"
                      : "border-[var(--border)] bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="text-[var(--muted)]">{i + 1}.</span>{" "}
                  {s.title.trim() || "（未命名）"}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        {/* 編輯區 */}
        <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">編輯第 {active + 1} 頁</p>
            <button
              type="button"
              onClick={() => moveSlide(active, -1)}
              disabled={active === 0}
              className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-40"
            >
              上移
            </button>
            <button
              type="button"
              onClick={() => moveSlide(active, 1)}
              disabled={active >= slides.length - 1}
              className="rounded border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-40"
            >
              下移
            </button>
            <button
              type="button"
              onClick={() => addSlide(active)}
              className="rounded border border-[var(--border)] px-2 py-1 text-xs"
            >
              在後方插入
            </button>
            <button
              type="button"
              onClick={() => removeSlide(active)}
              disabled={slides.length <= 1}
              className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 disabled:opacity-40"
            >
              刪除本頁
            </button>
          </div>

          <label className="block text-sm">
            <span className="font-medium">標題</span>
            <input
              value={current.title}
              onChange={(e) => updateSlide(active, { title: e.target.value })}
              className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>

          <div className="text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">條列重點</span>
              <button
                type="button"
                className="text-xs text-[var(--accent)] hover:underline"
                onClick={() =>
                  updateSlide(active, { bullets: [...current.bullets, ""] })
                }
              >
                加一列
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {current.bullets.map((b, bi) => (
                <div key={bi} className="flex gap-2">
                  <input
                    value={b}
                    onChange={(e) => {
                      const next = [...current.bullets];
                      next[bi] = e.target.value;
                      updateSlide(active, { bullets: next });
                    }}
                    placeholder="條列文字"
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                  <button
                    type="button"
                    className="shrink-0 text-xs text-rose-700"
                    onClick={() =>
                      updateSlide(active, {
                        bullets: current.bullets.filter((_, i) => i !== bi),
                      })
                    }
                  >
                    刪
                  </button>
                </div>
              ))}
              {current.bullets.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">尚無條列，可按「加一列」。</p>
              ) : null}
            </div>
          </div>

          <div className="text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">段落說明（選填）</span>
              <button
                type="button"
                className="text-xs text-[var(--accent)] hover:underline"
                onClick={() =>
                  updateSlide(active, { paragraphs: [...current.paragraphs, ""] })
                }
              >
                加一段
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {current.paragraphs.map((p, pi) => (
                <div key={pi} className="flex gap-2">
                  <textarea
                    value={p}
                    rows={2}
                    onChange={(e) => {
                      const next = [...current.paragraphs];
                      next[pi] = e.target.value;
                      updateSlide(active, { paragraphs: next });
                    }}
                    className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                  />
                  <button
                    type="button"
                    className="shrink-0 text-xs text-rose-700"
                    onClick={() =>
                      updateSlide(active, {
                        paragraphs: current.paragraphs.filter((_, i) => i !== pi),
                      })
                    }
                  >
                    刪
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={pending}
              onClick={exportPptx}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {pending ? "匯出中…" : "確認排版並下載 PPTX"}
            </button>
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </section>

        {/* 預覽 */}
        <aside className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
          <p className="text-xs font-semibold text-[var(--muted)]">即時預覽</p>
          <div className="mt-3 aspect-video rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            {active === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-base font-semibold text-[var(--fg)]">
                  {current.title || "（標題）"}
                </p>
                <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
                  {previewBullets.map((b, i) => (
                    <p key={i}>{b}</p>
                  ))}
                </div>
                <p className="mt-4 text-[10px] text-blue-700">單元教材簡報</p>
              </div>
            ) : (
              <div className="h-full overflow-hidden">
                <p className="border-b border-blue-100 pb-2 text-sm font-semibold text-blue-700">
                  {current.title || "（標題）"}
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-[var(--fg)]">
                  {previewBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                <div className="mt-3 space-y-2 text-xs text-[var(--muted)]">
                  {previewParas.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {previewBullets.length === 0 && previewParas.length === 0 ? (
                  <p className="mt-3 text-xs text-[var(--muted)]">（本段無正文）</p>
                ) : null}
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            第一張預設為封面版型；可調整順序後再匯出。
          </p>
        </aside>
      </div>
    </div>
  );
}
