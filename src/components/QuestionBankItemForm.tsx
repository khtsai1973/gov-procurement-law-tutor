"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteQuestionBankItem, saveQuestionBankItem } from "@/app/actions/question-bank";

export type QuestionBankItemFormValues = {
  id?: string;
  key: string;
  question: string;
  category: string;
  keywordsText: string;
  relatedSlugsText: string;
  hintAnswer: string;
};

export function QuestionBankItemForm({
  initial,
  categories,
}: {
  initial?: QuestionBankItemFormValues;
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const result = await saveQuestionBankItem({
        id: initial?.id,
        key: String(fd.get("key") ?? ""),
        question: String(fd.get("question") ?? ""),
        category: String(fd.get("category") ?? ""),
        keywordsText: String(fd.get("keywordsText") ?? ""),
        relatedSlugsText: String(fd.get("relatedSlugsText") ?? ""),
        hintAnswer: String(fd.get("hintAnswer") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOkMsg("已儲存");
      router.refresh();
      if (!initial?.id) {
        router.push("/teacher/question-bank");
      }
    });
  }

  function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm("確定刪除此題庫題目？")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteQuestionBankItem(initial.id!);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/teacher/question-bank");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">題目鍵值（key）</span>
          <input
            name="key"
            required
            defaultValue={initial?.key ?? ""}
            placeholder="例：threshold-audit-vs-announce"
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">分類</span>
          <input
            name="category"
            required
            list="qb-categories"
            defaultValue={initial?.category ?? ""}
            placeholder="例：金額門檻"
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
          />
          <datalist id="qb-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium">題目</span>
        <textarea
          name="question"
          required
          rows={4}
          defaultValue={initial?.question ?? ""}
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">關鍵詞（逗號或頓號分隔）</span>
        <input
          name="keywordsText"
          required
          defaultValue={initial?.keywordsText ?? ""}
          placeholder="例：公告金額、查核金額、巨額"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">相關法規 slug（選填，逗號分隔）</span>
        <input
          name="relatedSlugsText"
          defaultValue={initial?.relatedSlugsText ?? ""}
          placeholder="例：government-procurement-act,pcc-procurement-amount-thresholds"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 font-mono text-xs"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">學習／作答導引（選填）</span>
        <textarea
          name="hintAnswer"
          rows={3}
          defaultValue={initial?.hintAnswer ?? ""}
          placeholder="給學員或 RAG 的簡短導引，勿當成法條原文"
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {pending ? "儲存中…" : "儲存題目"}
        </button>
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
