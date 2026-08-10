"use client";

import { useState } from "react";

import { generateUnitMaterial } from "@/app/actions/teacher";
import { TOPIC_CATEGORY_OPTIONS } from "@/lib/question-bank-categories";

function isNextRedirectError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const dig = (e as { digest?: string }).digest ?? "";
  return dig.startsWith("NEXT_REDIRECT") || (e as { message?: string }).message === "NEXT_REDIRECT";
}

export function AiMaterialGenerateForm({ defaultCategory }: { defaultCategory?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    try {
      const result = await generateUnitMaterial({
        title: String(fd.get("title") ?? ""),
        category: String(fd.get("category") ?? ""),
        unitCode: String(fd.get("unitCode") ?? ""),
        focus: String(fd.get("focus") ?? ""),
        sortOrder: Number(fd.get("sortOrder") ?? 0),
        regulationVersion: String(fd.get("regulationVersion") ?? ""),
      });
      if (result && !result.ok) {
        setError(result.error);
        setPending(false);
      }
    } catch (err) {
      if (isNextRedirectError(err)) return;
      setError(err instanceof Error ? err.message : "產生失敗");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        AI 草稿產生後狀態為「待審」，<strong>須經教師核准</strong>後才能發布，不可直接公開。
      </p>

      <label className="block text-sm">
        <span className="font-medium">主題分類</span>
        <select
          name="category"
          required
          defaultValue={defaultCategory ?? TOPIC_CATEGORY_OPTIONS[0]}
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
        >
          {TOPIC_CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">單元代號（選填）</span>
          <input
            name="unitCode"
            placeholder="例：U01"
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">排序</span>
          <input
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={0}
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium">教材標題</span>
        <input
          name="title"
          required
          placeholder="例：總價結算與契約變更"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">教學聚焦（選填）</span>
        <textarea
          name="focus"
          rows={3}
          placeholder="例：請強調設計圖說與實際丈量差異、契約變更程序"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">法規版本（選填）</span>
        <input
          name="regulationVersion"
          placeholder="例：政府採購法（現行）／請教師核對最新修正"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {pending ? "產生中…" : "產生 AI 草稿並進入審核"}
        </button>
        <a
          href="/teacher/materials"
          className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm no-underline hover:bg-slate-50"
        >
          取消
        </a>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </form>
  );
}
