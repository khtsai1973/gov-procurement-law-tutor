"use client";

import Link from "next/link";
import { useState } from "react";

import {
  deleteUnitMaterial,
  markUnitMaterialReviewed,
  saveUnitMaterial,
} from "@/app/actions/teacher";
import {
  canPublishMaterial,
  materialStatusLabel,
  materialStatusTone,
} from "@/lib/material-review";
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
  source?: string;
  reviewStatus?: string;
};

export const TEACHER_MATERIALS_HOME = "/teacher/materials";

function isNextRedirectError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const dig = (e as { digest?: string }).digest ?? "";
  return dig.startsWith("NEXT_REDIRECT") || (e as { message?: string }).message === "NEXT_REDIRECT";
}

function toneClass(tone: ReturnType<typeof materialStatusTone>): string {
  switch (tone) {
    case "emerald":
      return "text-emerald-700";
    case "sky":
      return "text-sky-800";
    case "amber":
      return "text-amber-800";
    default:
      return "text-[var(--muted)]";
  }
}

export function UnitMaterialForm({
  initial,
  defaultCategory,
  justGenerated,
}: {
  initial?: UnitMaterialFormValues;
  defaultCategory?: string;
  justGenerated?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState(initial?.reviewStatus ?? "NONE");
  const [publishedChecked, setPublishedChecked] = useState(initial?.published ?? false);

  const source = initial?.source === "AI" ? "AI" : "MANUAL";
  const reviewFields = {
    source,
    reviewStatus,
    published: publishedChecked,
  };
  const statusLabel = materialStatusLabel(reviewFields);
  const publishAllowed = canPublishMaterial(reviewFields);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setOkMsg(null);
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

  async function onMarkReviewed() {
    if (!initial?.id) return;
    setError(null);
    setOkMsg(null);
    setPending(true);
    try {
      const result = await markUnitMaterialReviewed(initial.id);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      setReviewStatus("APPROVED");
      setOkMsg(result.message);
      setPending(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "審核失敗");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {justGenerated ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          AI 草稿已產生，目前為「待審核」。請檢視並修改內容後，按下「標記審核完成」，才可發布給學員。
        </p>
      ) : null}

      {initial?.id ? (
        <p className={`text-sm font-medium ${toneClass(materialStatusTone(reviewFields))}`}>
          狀態：{statusLabel}
          {source === "AI" ? <span className="ml-2 text-xs font-normal text-[var(--muted)]">（AI 產生）</span> : null}
          {initial.published ? (
            <span className="ml-2 text-xs font-normal text-[var(--muted)]">發布後仍可編輯儲存</span>
          ) : null}
        </p>
      ) : null}

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

      {source === "AI" && reviewStatus !== "APPROVED" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <span>AI 教材須先完成審核，才能勾選發布。</span>
          <button
            type="button"
            disabled={pending}
            onClick={onMarkReviewed}
            className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {pending ? "處理中…" : "標記審核完成"}
          </button>
        </div>
      ) : null}

      {source === "AI" && reviewStatus === "APPROVED" ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          已審核完成。可發布給學員；發布後仍可回來編輯修改。
        </p>
      ) : null}

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          name="published"
          type="checkbox"
          checked={publishedChecked}
          disabled={!publishAllowed && !publishedChecked}
          onChange={(e) => setPublishedChecked(e.target.checked)}
          className="rounded border-[var(--border)] disabled:opacity-50"
        />
        發布給學員閱讀
        {!publishAllowed ? (
          <span className="text-xs text-amber-800">（請先標記審核完成）</span>
        ) : null}
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
        {initial?.id && source === "AI" && reviewStatus !== "APPROVED" ? (
          <button
            type="button"
            disabled={pending}
            onClick={onMarkReviewed}
            className="rounded-md border border-sky-300 bg-sky-50 px-4 py-2 text-sm text-sky-900 hover:bg-sky-100 disabled:opacity-60"
          >
            標記審核完成
          </button>
        ) : null}
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
        {okMsg ? <span className="text-sm text-emerald-700">{okMsg}</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </form>
  );
}
