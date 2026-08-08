"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteUnitMaterial, saveUnitMaterial } from "@/app/actions/teacher";
import { TOPIC_CATEGORY_OPTIONS } from "@/lib/question-bank-categories";

export type UnitMaterialFormValues = {
  id?: string;
  title: string;
  category: string;
  unitCode: string;
  summary: string;
  content: string;
  sortOrder: number;
  published: boolean;
};

export function UnitMaterialForm({
  initial,
  listHref = "/teacher/materials",
}: {
  initial?: UnitMaterialFormValues;
  /** 儲存／返回後要回到的單元教材功能頁 */
  listHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function goToMaterialsList(extra?: { saved?: boolean; id?: string }) {
    const url = new URL(listHref, window.location.origin);
    if (extra?.saved) url.searchParams.set("saved", "1");
    if (extra?.id) url.searchParams.set("highlight", extra.id);
    router.push(`${url.pathname}${url.search}`);
    router.refresh();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const result = await saveUnitMaterial({
        id: initial?.id,
        title: String(fd.get("title") ?? ""),
        category: String(fd.get("category") ?? ""),
        unitCode: String(fd.get("unitCode") ?? ""),
        summary: String(fd.get("summary") ?? ""),
        content: String(fd.get("content") ?? ""),
        sortOrder: Number(fd.get("sortOrder") ?? 0),
        published: fd.get("published") === "on",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOkMsg("已儲存，正在返回單元教材…");
      goToMaterialsList({ saved: true, id: result.id });
    });
  }

  function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm("確定刪除此單元教材？")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteUnitMaterial(initial.id!);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goToMaterialsList();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">主題分類</span>
        <select
          name="category"
          required
          defaultValue={initial?.category ?? TOPIC_CATEGORY_OPTIONS[0]}
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
        >
          {TOPIC_CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-[var(--muted)]">
          請依正式 14 類主題分類製作教材；儲存後會返回單元教材功能頁。內容可匯出 PPTX 簡報。
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">單元代號</span>
          <input
            name="unitCode"
            defaultValue={initial?.unitCode ?? ""}
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
            defaultValue={initial?.sortOrder ?? 0}
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium">標題</span>
        <input
          name="title"
          required
          defaultValue={initial?.title ?? ""}
          placeholder="例：第一單元｜採購金額門檻"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">摘要（選填）</span>
        <input
          name="summary"
          defaultValue={initial?.summary ?? ""}
          placeholder="簡短說明本單元重點"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">教材內容</span>
        <textarea
          name="content"
          required
          rows={14}
          defaultValue={initial?.content ?? ""}
          placeholder={
            "建議使用 Markdown 標題分段，匯出簡報時會自動切成投影片，例如：\n\n## 學習目標\n- 重點一\n- 重點二\n\n## 法規依據\n說明文字…"
          }
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 font-mono text-sm"
        />
      </label>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          name="published"
          type="checkbox"
          defaultChecked={initial?.published ?? false}
          className="rounded border-[var(--border)]"
        />
        發布給學員閱讀
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {pending ? "儲存中…" : "儲存並返回單元教材"}
        </button>
        <Link
          href={listHref}
          className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--fg)] no-underline hover:bg-slate-50"
        >
          返回單元教材
        </Link>
        {initial?.id ? (
          <a
            href={`/api/teacher/materials/${initial.id}/presentation`}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800 no-underline hover:bg-indigo-100"
          >
            下載簡報（PPTX）
          </a>
        ) : null}
        {initial?.id ? (
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="rounded-md border border-rose-300 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            刪除
          </button>
        ) : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
        {okMsg ? <span className="text-sm text-emerald-700">{okMsg}</span> : null}
      </div>
    </form>
  );
}
