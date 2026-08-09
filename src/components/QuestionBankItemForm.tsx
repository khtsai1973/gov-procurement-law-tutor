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
  importance?: "high" | "normal";
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
        importance: String(fd.get("importance") ?? "normal") === "high" ? "high" : "normal",
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
        <span className="font-medium">檢索關鍵詞（後台用，逗號或頓號分隔）</span>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          供問答檢索擴展；前台題庫頁改顯示語意「概念標籤」，請勿貼上固定字數切出的碎句。
        </p>
        <input
          name="keywordsText"
          required
          defaultValue={initial?.keywordsText ?? ""}
          placeholder="例：總價結算、契約變更、技術服務費"
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
        <span className="font-medium">學習導引／完整解析</span>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          高頻或重要題請寫「完整解析」（含結論、考點、易錯點）。選擇題請保留「參考答案為…」以便自動評分。
        </p>
        <textarea
          name="hintAnswer"
          rows={8}
          defaultValue={initial?.hintAnswer ?? ""}
          placeholder={"例：\n【題庫】本題參考答案為 選項 (2)。\n\n【完整解析】\n一、結論…\n二、考點說明…"}
          className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="importance"
          value="high"
          defaultChecked={initial?.importance === "high"}
          className="mt-1 rounded border-[var(--border)]"
        />
        <span>
          <span className="font-medium">標記為重要／高頻題</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            建議此類題目具備完整解析，模擬考試與題庫瀏覽會特別標示。
          </span>
        </span>
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
