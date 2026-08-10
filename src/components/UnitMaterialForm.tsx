"use client";

import Link from "next/link";
import { useState } from "react";

import {
  approveUnitMaterial,
  deleteUnitMaterial,
  returnUnitMaterial,
  saveUnitMaterial,
  submitUnitMaterialForReview,
} from "@/app/actions/teacher";
import { MaterialInfoFields } from "@/components/MaterialInfoFields";
import type { MaterialInfoFields as MaterialInfoValues } from "@/lib/material-info";
import {
  canApproveMaterial,
  canPublishMaterial,
  canReturnMaterial,
  canSubmitForReview,
  DEFAULT_REGULATION_VERSION,
  materialStatusLabel,
  materialStatusTone,
  type MaterialRevisionEntry,
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
  regulationVersion?: string;
  reviewNote?: string;
};

export type UnitMaterialFormMeta = {
  info: MaterialInfoValues;
  revisionLog: MaterialRevisionEntry[];
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
    case "rose":
      return "text-rose-700";
    default:
      return "text-[var(--muted)]";
  }
}

export function UnitMaterialForm({
  initial,
  meta,
  defaultCategory,
  justGenerated,
}: {
  initial?: UnitMaterialFormValues;
  meta?: UnitMaterialFormMeta;
  defaultCategory?: string;
  justGenerated?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState(
    initial?.reviewStatus ?? "DRAFT",
  );
  const [publishedChecked, setPublishedChecked] = useState(
    initial?.published ?? false,
  );
  const [reviewNote, setReviewNote] = useState(initial?.reviewNote ?? "");
  const [returnNote, setReturnNote] = useState("");
  const [showReturnBox, setShowReturnBox] = useState(false);

  const source = initial?.source === "AI" ? "AI" : "MANUAL";
  const reviewFields = {
    source,
    reviewStatus,
    published: publishedChecked,
  };
  const statusLabel = materialStatusLabel(reviewFields);
  const publishAllowed = canPublishMaterial(reviewFields);
  const showSubmit = Boolean(initial?.id) && canSubmitForReview(reviewFields);
  const showApprove = Boolean(initial?.id) && canApproveMaterial(reviewFields);
  const showReturn = Boolean(initial?.id) && canReturnMaterial(reviewFields);

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
        regulationVersion: String(fd.get("regulationVersion") ?? ""),
        revisionNote: String(fd.get("revisionNote") ?? ""),
      });
      if (result && !result.ok) {
        setError(result.error ?? "儲存失敗");
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
        setError(result.error ?? "刪除失敗");
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

  async function onSubmitReview() {
    if (!initial?.id) return;
    setError(null);
    setOkMsg(null);
    setPending(true);
    try {
      const result = await submitUnitMaterialForReview(initial.id);
      if (!result.ok) {
        setError(result.error ?? "送審失敗");
        setPending(false);
        return;
      }
      setReviewStatus("PENDING_REVIEW");
      setPublishedChecked(false);
      setOkMsg(result.message);
      setPending(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送審失敗");
      setPending(false);
    }
  }

  async function onApprove() {
    if (!initial?.id) return;
    setError(null);
    setOkMsg(null);
    setPending(true);
    try {
      const result = await approveUnitMaterial(initial.id, "教師核准");
      if (!result.ok) {
        setError(result.error ?? "核准失敗");
        setPending(false);
        return;
      }
      setReviewStatus("APPROVED");
      setReviewNote("教師核准");
      setOkMsg(result.message);
      setPending(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "核准失敗");
      setPending(false);
    }
  }

  async function onReturn() {
    if (!initial?.id) return;
    const note = returnNote.trim();
    if (!note) {
      setError("請填寫退回修正原因");
      return;
    }
    setError(null);
    setOkMsg(null);
    setPending(true);
    try {
      const result = await returnUnitMaterial(initial.id, note);
      if (!result.ok) {
        setError(result.error ?? "退回失敗");
        setPending(false);
        return;
      }
      setReviewStatus("RETURNED");
      setPublishedChecked(false);
      setReviewNote(note);
      setShowReturnBox(false);
      setReturnNote("");
      setOkMsg(result.message);
      setPending(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "退回失敗");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {justGenerated ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          AI 草稿已產生，狀態為「待審」。請檢視法規引用與內容後，送審／核准通過才可發布，不可直接公開。
        </p>
      ) : null}

      {initial?.id ? (
        <div className="rounded-md border border-[var(--border)] bg-slate-50/80 px-3 py-3 text-sm">
          <p className={`font-medium ${toneClass(materialStatusTone(reviewFields))}`}>
            狀態：{statusLabel}
            {source === "AI" ? (
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                （AI 產生）
              </span>
            ) : (
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                （教師手寫）
              </span>
            )}
          </p>

          {meta ? (
            <MaterialInfoFields
              className="mt-3 border-0 bg-transparent p-0"
              info={{
                ...meta.info,
                regulationVersion:
                  initial?.regulationVersion?.trim() || meta.info.regulationVersion,
              }}
            />
          ) : null}

          {reviewNote && reviewStatus === "RETURNED" ? (
            <p className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
              退回說明：{reviewNote}
            </p>
          ) : null}

          {meta && meta.revisionLog.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-[var(--fg)]">
                修正歷程（{meta.revisionLog.length}）
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-[var(--muted)]">
                {meta.revisionLog.map((entry, i) => (
                  <li
                    key={`${entry.at}-${i}`}
                    className="border-b border-[var(--border)]/60 py-1"
                  >
                    <span className="text-[var(--fg)]/80">
                      {entry.fromStatus || "—"} → {entry.toStatus || "—"}
                    </span>
                    {" · "}
                    {entry.at}
                    {entry.byName ? ` · ${entry.byName}` : ""}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {source === "AI" && !publishedChecked && reviewStatus !== "APPROVED" ? (
            <p className="mt-2 text-xs text-amber-900">
              法律型教材流程：草稿／待審 → 已核准 → 已發布；必要時可「退回修正」。AI
              產生後不可直接發布。
            </p>
          ) : null}
        </div>
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
        <span className="font-medium">法規版本</span>
        <input
          name="regulationVersion"
          defaultValue={
            initial?.regulationVersion ?? DEFAULT_REGULATION_VERSION
          }
          placeholder="例：政府採購法（現行）"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">
          請註明本教材依據之法規／函釋版本，方便後續追蹤修正。
        </span>
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

      <label className="block text-sm">
        <span className="font-medium">本次修正說明（選填）</span>
        <input
          name="revisionNote"
          placeholder="儲存時會寫入最後修正紀錄"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
        />
      </label>

      {showSubmit || showApprove || showReturn ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <span className="w-full sm:w-auto">審核流程：</span>
          {showSubmit ? (
            <button
              type="button"
              disabled={pending}
              onClick={onSubmitReview}
              className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
            >
              送審（待審）
            </button>
          ) : null}
          {showApprove ? (
            <button
              type="button"
              disabled={pending}
              onClick={onApprove}
              className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
            >
              核准
            </button>
          ) : null}
          {showReturn ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowReturnBox((v) => !v)}
              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-60"
            >
              退回修正
            </button>
          ) : null}
        </div>
      ) : null}

      {showReturnBox ? (
        <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-3">
          <label className="block text-sm">
            <span className="font-medium text-rose-950">退回修正說明（必填）</span>
            <textarea
              rows={3}
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="請說明需修正的法規引用、段落或不精確處"
              className="mt-1 w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !returnNote.trim()}
              onClick={onReturn}
              className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-60"
            >
              確認退回
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowReturnBox(false)}
              className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {reviewStatus === "APPROVED" && !publishedChecked ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          已核准。確認無誤後可勾選「發布給學員閱讀」。
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
          <span className="text-xs text-amber-800">
            （{source === "AI" ? "須先核准" : "目前狀態不可發布"}）
          </span>
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
