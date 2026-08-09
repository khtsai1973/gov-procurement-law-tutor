"use client";

import Link from "next/link";
import { useState } from "react";

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

export const TEACHER_MATERIALS_HOME = "/teacher/materials";

function isNextRedirectError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const dig = (e as { digest?: string }).digest ?? "";
  // Next.js redirect() from Server Actions surfaces as NEXT_REDIRECT
  return dig.startsWith("NEXT_REDIRECT") || (e as { message?: string }).message === "NEXT_REDIRECT";
}

export function UnitMaterialForm({
  initial,
  defaultCategory,
}: {
  initial?: UnitMaterialFormValues;
  defaultCategory?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setPending(true);
    try {
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
      // 成功時 action 會 redirect；若仍回到這裡表示失敗
      if (result && !result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      // 後援：若未觸發 redirect，強制回首頁
      window.location.replace(TEACHER_MATERIALS_HOME);
    } catch (err) {
      if (isNextRedirectError(err)) {
        // 讓 Next 處理導向；再加硬導向保險
        window.location.replace(TEACHER_MATERIALS_HOME);
        return;
      }
      setError(err instanceof Error ? err.message : "儲存失敗");
      setPending(false);
    }
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm("確定刪除此單元教材？")) return;
    setError(null);
    setPending(true);
    try {
      const result = await deleteUnitMaterial(initial.id);
      if (result && !result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      window.location.replace(TEACHER_MATERIALS_HOME);
    } catch (err) {
      if (isNextRedirectError(err)) {
        window.location.replace(TEACHER_MATERIALS_HOME);
        return;
      }
      setError(err instanceof Error ? err.message : "刪除失敗");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium">主題分類</span>
        <select
          name="category"
          required
          defaultValue={
            initial?.category ?? defaultCategory ?? TOPIC_CATEGORY_OPTIONS[0]
          }
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2"
        >
          {TOPIC_CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-[var(--muted)]">
          按「儲存」後會離開本頁，回到單元教材首頁（教材列表）。
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
          {pending ? "儲存中…" : "儲存並返回首頁"}
        </button>
        <a
          href={TEACHER_MATERIALS_HOME}
          className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--fg)] no-underline hover:bg-slate-50"
        >
          返回單元教材首頁
        </a>
        {initial?.id ? (
          <Link
            href={`/teacher/materials/${initial.id}/presentation`}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800 no-underline hover:bg-indigo-100"
          >
            簡報排版／匯出
          </Link>
        ) : null}
        {initial?.id ? (
          <a
            href={`/api/teacher/materials/${initial.id}/document?format=docx`}
            className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900 no-underline hover:bg-sky-100"
          >
            文件 DOCX
          </a>
        ) : null}
        {initial?.id ? (
          <a
            href={`/api/teacher/materials/${initial.id}/document?format=pdf`}
            className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900 no-underline hover:bg-rose-100"
          >
            文件 PDF
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
      </div>
    </form>
  );
}
