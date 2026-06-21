"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { updateNickname } from "@/app/actions/profile";
import {
  MOCK_EXAM_COUNT_OPTIONS,
  NICKNAME_PRESETS,
  formatDuration,
  mockExamTimeLimitSec,
  type MockExamQuestionPayload,
  type MockExamQuestionType,
  type MockExamRegulationLink,
  type MockExamRevealResult,
} from "@/lib/mock-exam";

type Phase = "setup" | "exam" | "summary";

type QuestionState = MockExamQuestionPayload & {
  userAnswer: string;
  revealed: MockExamRevealResult | null;
  revealError: string | null;
  sourceNoteDraft: string;
  supplementDraft: string;
  supplementSaving: boolean;
  supplementSaved: boolean;
};

type MockExamPanelProps = {
  signedIn: boolean;
  initialNickname: string | null;
  history: ReactNode;
};

export function MockExamPanel({ signedIn, initialNickname, history }: MockExamPanelProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [nickname, setNickname] = useState(initialNickname ?? "");
  const [nicknameMsg, setNicknameMsg] = useState<string | null>(null);
  const [examType, setExamType] = useState<MockExamQuestionType>("MULTIPLE_CHOICE");
  const [examCount, setExamCount] = useState<(typeof MOCK_EXAM_COUNT_OPTIONS)[number]>(5);
  const [timedMode, setTimedMode] = useState(false);
  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLimitSec, setTimeLimitSec] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [finishSaving, setFinishSaving] = useState(false);
  const [finishSaved, setFinishSaved] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poolNote, setPoolNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const examStartedAtRef = useRef<number>(0);
  const finishCalledRef = useRef(false);
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const completeExam = useCallback(async () => {
    if (finishCalledRef.current) return;
    finishCalledRef.current = true;

    const elapsed = examStartedAtRef.current
      ? Math.floor((Date.now() - examStartedAtRef.current) / 1000)
      : 0;
    setElapsedSec(elapsed);
    setPhase("summary");

    if (!sessionId) return;

    setFinishSaving(true);
    setFinishError(null);
    try {
      const answers = questionsRef.current.map((q, index) => ({
        itemKey: q.key,
        questionIndex: index,
        userAnswer: q.userAnswer || null,
        referenceAnswer: q.revealed?.referenceAnswer ?? null,
        isCorrect: q.revealed?.isCorrect ?? null,
        revealed: !!q.revealed,
        sourceNote: q.sourceNoteDraft.trim() || null,
      }));

      const res = await fetch("/api/mock-exam/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, elapsedSec: elapsed, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFinishError(typeof data.error === "string" ? data.error : "無法儲存測驗紀錄");
        return;
      }
      setFinishSaved(true);
      router.refresh();
    } catch {
      setFinishError("無法連線，測驗紀錄可能未儲存");
    } finally {
      setFinishSaving(false);
    }
  }, [sessionId, router]);

  useEffect(() => {
    if (phase !== "exam" || !timedMode || timeLimitSec == null) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - examStartedAtRef.current) / 1000);
      const left = Math.max(0, timeLimitSec - elapsed);
      setRemainingSec(left);
      setElapsedSec(elapsed);
      if (left <= 0 && !finishCalledRef.current) {
        setTimeExpired(true);
        void completeExam();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, timedMode, timeLimitSec, completeExam]);

  if (!signedIn) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">題庫模擬考試</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          請先登入後使用模擬考試功能，以便保存暱稱、測驗紀錄與題目補充筆記。
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          返回首頁登入
        </Link>
      </section>
    );
  }

  async function saveNickname() {
    setNicknameMsg(null);
    startTransition(async () => {
      const result = await updateNickname(nickname);
      if (result.error) {
        setNicknameMsg(result.error);
        return;
      }
      setNicknameMsg("暱稱已儲存");
    });
  }

  function resetExamState() {
    setQuestions([]);
    setSessionId(null);
    setTimeLimitSec(null);
    setRemainingSec(null);
    setElapsedSec(0);
    setTimeExpired(false);
    setFinishSaving(false);
    setFinishSaved(false);
    setFinishError(null);
    finishCalledRef.current = false;
    examStartedAtRef.current = 0;
  }

  async function startExam() {
    setError(null);
    setPoolNote(null);
    resetExamState();
    setLoading(true);
    try {
      const res = await fetch("/api/mock-exam/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: examType,
          count: examCount,
          timedMode,
          nickname: nickname.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "無法載入題目");
        return;
      }
      if (typeof data.nickname === "string" && data.nickname && !nickname.trim()) {
        setNickname(data.nickname);
      }
      const loaded = (data.questions as MockExamQuestionPayload[]).map((q) => ({
        ...q,
        userAnswer: "",
        revealed: null,
        revealError: null,
        sourceNoteDraft: "",
        supplementDraft: "",
        supplementSaving: false,
        supplementSaved: false,
      }));
      if (loaded.length === 0) {
        setError("沒有可用的題目");
        return;
      }
      if (data.actual < data.requested) {
        setPoolNote(
          `題庫中此題型僅 ${data.totalInPool} 題，已為您抽出 ${data.actual} 題。`,
        );
      }

      const limit =
        typeof data.timeLimitSec === "number"
          ? data.timeLimitSec
          : mockExamTimeLimitSec(loaded.length, timedMode);

      setSessionId(typeof data.sessionId === "string" ? data.sessionId : null);
      setTimeLimitSec(limit);
      setRemainingSec(limit);
      examStartedAtRef.current = Date.now();
      setQuestions(loaded);
      setCurrentIndex(0);
      setPhase("exam");
    } catch {
      setError("無法連線，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function revealCurrent() {
    const q = questions[currentIndex];
    if (!q || !q.userAnswer) return;

    setQuestions((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex]!, revealError: null };
      return next;
    });

    try {
      const res = await fetch("/api/mock-exam/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: q.key, userAnswer: q.userAnswer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuestions((prev) => {
          const next = [...prev];
          next[currentIndex] = {
            ...next[currentIndex]!,
            revealError: typeof data.error === "string" ? data.error : "無法取得解答",
          };
          return next;
        });
        return;
      }

      setQuestions((prev) => {
        const next = [...prev];
        next[currentIndex] = {
          ...next[currentIndex]!,
          revealed: data as MockExamRevealResult,
          sourceNoteDraft: (data.sourceNote as string | null) ?? "",
          supplementDraft: (data.supplement as string | null) ?? "",
        };
        return next;
      });
    } catch {
      setQuestions((prev) => {
        const next = [...prev];
        next[currentIndex] = { ...next[currentIndex]!, revealError: "無法連線" };
        return next;
      });
    }
  }

  async function saveSupplement(index: number) {
    const q = questions[index];
    if (!q?.supplementDraft.trim() && !q?.sourceNoteDraft.trim()) return;

    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, supplementSaving: true, supplementSaved: false };
      return next;
    });

    try {
      const res = await fetch("/api/mock-exam/supplement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: q.key,
          supplement: q.supplementDraft,
          sourceNote: q.sourceNoteDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setQuestions((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index]!,
          supplementSaving: false,
          supplementSaved: res.ok,
          revealError: res.ok ? null : (data.error ?? "儲存失敗"),
        };
        return next;
      });
    } catch {
      setQuestions((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index]!,
          supplementSaving: false,
          revealError: "無法連線",
        };
        return next;
      });
    }
  }

  function updateAnswer(value: string) {
    setQuestions((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        ...next[currentIndex]!,
        userAnswer: value,
        revealed: null,
        revealError: null,
      };
      return next;
    });
  }

  function updateSourceNoteDraft(value: string) {
    setQuestions((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex]!, sourceNoteDraft: value, supplementSaved: false };
      return next;
    });
  }

  function updateSupplementDraft(value: string) {
    setQuestions((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex]!, supplementDraft: value, supplementSaved: false };
      return next;
    });
  }

  const current = questions[currentIndex];
  const revealedCount = questions.filter((q) => q.revealed).length;
  const answeredCount = questions.filter((q) => q.userAnswer.trim()).length;
  const correctCount = questions.filter((q) => q.revealed?.isCorrect === true).length;
  const gradableCount = questions.filter((q) => q.revealed && q.revealed.isCorrect !== null).length;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">題庫模擬考試</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              自題庫隨機抽題，支援計時模式與測驗紀錄；作答後顯示參考答案、法規來源，並可為每題註記解答來源。
            </p>
          </div>
          <Link href="/" className="text-sm no-underline hover:underline">
            ← 回到問答
          </Link>
        </div>
      </div>

      {phase === "setup" ? (
        <>
          <div className="mock-exam-setup rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <h2 className="text-base font-semibold">開始設定</h2>

            <div className="mt-4">
              <label className="block text-sm font-medium" htmlFor="nickname">
                您的暱稱
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {NICKNAME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNickname(preset)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      nickname === preset
                        ? "border-[var(--accent)] bg-blue-50 text-[var(--accent)]"
                        : "border-[var(--border)] bg-white hover:bg-gray-50"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={24}
                  placeholder="或輸入自訂暱稱"
                  className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={saveNickname}
                  disabled={isPending || !nickname.trim()}
                  className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  儲存暱稱
                </button>
              </div>
              {nicknameMsg ? <p className="mt-2 text-xs text-green-700">{nicknameMsg}</p> : null}
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium">題型</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {(
                  [
                    ["MULTIPLE_CHOICE", "選擇題"],
                    ["TRUE_FALSE", "是非題"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="exam-type"
                      checked={examType === value}
                      onChange={() => setExamType(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium">題數</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {MOCK_EXAM_COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setExamCount(n)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      examCount === n
                        ? "border-[var(--accent)] bg-blue-50 text-[var(--accent)]"
                        : "border-[var(--border)] bg-white hover:bg-gray-50"
                    }`}
                  >
                    {n} 題
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium">計時模式</p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={timedMode}
                  onChange={(e) => setTimedMode(e.target.checked)}
                />
                啟用計時（每題 60 秒，共 {formatDuration(mockExamTimeLimitSec(examCount, true) ?? 0)}）
              </label>
              <p className="mt-1 text-xs text-[var(--muted)]">
                時間到會自動交卷並儲存測驗紀錄。
              </p>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <button
              type="button"
              onClick={startExam}
              disabled={loading}
              className="mt-6 rounded-md bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? "載入題目中…" : nickname.trim() ? `${nickname}，開始測驗` : "開始測驗"}
            </button>
          </div>
          {history}
        </>
      ) : null}

      {phase === "exam" && current ? (
        <div className="mock-exam-active space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm">
            <span>
              {nickname.trim() ? `${nickname} · ` : ""}
              第 {currentIndex + 1} / {questions.length} 題
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {timedMode && remainingSec != null ? (
                <span
                  className={`font-mono font-semibold ${
                    remainingSec <= 30 ? "text-red-600" : "text-amber-800"
                  }`}
                >
                  剩餘 {formatDuration(remainingSec)}
                </span>
              ) : (
                <span className="font-mono text-[var(--muted)]">已用時 {formatDuration(elapsedSec)}</span>
              )}
              <span className="text-[var(--muted)]">
                {examType === "TRUE_FALSE" ? "是非題" : "選擇題"} · 已確認 {revealedCount} 題
              </span>
            </div>
          </div>

          {timeExpired ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              時間到，已自動交卷。
            </p>
          ) : null}

          {poolNote ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {poolNote}
            </p>
          ) : null}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <p className="text-xs text-[var(--muted)]">{current.category}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{current.question}</p>

            <div className="mt-5 space-y-2">
              {current.options.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                    current.userAnswer === opt.value
                      ? "border-[var(--accent)] bg-blue-50"
                      : "border-[var(--border)] hover:bg-gray-50"
                  } ${current.revealed || timeExpired ? "pointer-events-none opacity-90" : ""}`}
                >
                  <input
                    type="radio"
                    name={`answer-${current.key}`}
                    value={opt.value}
                    checked={current.userAnswer === opt.value}
                    disabled={!!current.revealed || timeExpired}
                    onChange={() => updateAnswer(opt.value)}
                    className="mt-0.5"
                  />
                  <span>
                    {current.type === "MULTIPLE_CHOICE" ? (
                      <>
                        <strong>({opt.value})</strong> {opt.label}
                      </>
                    ) : (
                      opt.label
                    )}
                  </span>
                </label>
              ))}
            </div>

            {!current.revealed && !timeExpired ? (
              <button
                type="button"
                onClick={revealCurrent}
                disabled={!current.userAnswer}
                className="mt-5 rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                確認答案
              </button>
            ) : current.revealed ? (
              <div className="mock-exam-reveal mt-6 space-y-4 border-t border-[var(--border)] pt-5">
                {current.revealed.isCorrect === true ? (
                  <p className="text-sm font-medium text-green-700">答對了</p>
                ) : current.revealed.isCorrect === false ? (
                  <p className="text-sm font-medium text-red-600">
                    答錯了
                    {current.revealed.referenceAnswer
                      ? `（參考答案：${current.revealed.referenceAnswer}）`
                      : ""}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-[var(--muted)]">已記錄您的答案</p>
                )}

                {current.revealed.hintAnswer ? (
                  <div className="rounded-lg bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950">
                    <p className="font-semibold">解答提示</p>
                    <p className="mt-1">{current.revealed.hintAnswer}</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
                    <p className="font-semibold">題庫尚無解答提示</p>
                    <p className="mt-1">請在下方輸入您的補充說明或參考來源，系統會為您保存。</p>
                  </div>
                )}

                {current.revealed.regulations.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold">系統法規／函釋來源</p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {current.revealed.regulations.map((reg: MockExamRegulationLink) => (
                        <li key={reg.slug} className="rounded-lg border border-[var(--border)] p-3">
                          <span className="font-medium">{reg.title}</span>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs">
                            <Link href="/regulations" className="underline">
                              見法規／函釋清單
                            </Link>
                            {reg.sourceUrl ? (
                              <a
                                href={reg.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                外部來源
                              </a>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium" htmlFor="source-note">
                    解答來源註記
                  </label>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    註記此題答案所依據的法條、函釋或參考資料，交卷時一併保存至測驗紀錄。
                  </p>
                  <textarea
                    id="source-note"
                    value={current.sourceNoteDraft}
                    onChange={(e) => updateSourceNoteDraft(e.target.value)}
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
                    placeholder="例：政府採購法第22條第1項、工程會90年3月15日函釋…"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium" htmlFor="supplement">
                    {current.revealed.hintAnswer ? "我的補充筆記（選填）" : "我的補充說明（選填）"}
                  </label>
                  <textarea
                    id="supplement"
                    value={current.supplementDraft}
                    onChange={(e) => updateSupplementDraft(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-[var(--border)] p-3 text-sm"
                    placeholder="例：依採購法第○條，或工程會函釋…"
                  />
                  <button
                    type="button"
                    onClick={() => saveSupplement(currentIndex)}
                    disabled={
                      current.supplementSaving ||
                      (!current.supplementDraft.trim() && !current.sourceNoteDraft.trim())
                    }
                    className="mt-2 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {current.supplementSaving
                      ? "儲存中…"
                      : current.supplementSaved
                        ? "已儲存"
                        : "儲存註記與補充"}
                  </button>
                </div>

                {current.revealError ? (
                  <p className="text-sm text-red-600">{current.revealError}</p>
                ) : null}
              </div>
            ) : null}

            {!timeExpired ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => i - 1)}
                  className="rounded-md border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
                >
                  上一題
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((i) => i + 1)}
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white"
                  >
                    下一題
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void completeExam()}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white"
                  >
                    完成測驗
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === "summary" ? (
        <>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold">測驗完成</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {nickname.trim() ? `${nickname}，` : ""}
              共 {questions.length} 題，已選答 {answeredCount} 題，已確認 {revealedCount} 題
              {gradableCount > 0
                ? `，答對 ${correctCount}/${gradableCount} 題（${Math.round((correctCount / gradableCount) * 100)}%）`
                : correctCount > 0
                  ? `，答對 ${correctCount} 題`
                  : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              用時 {formatDuration(elapsedSec)}
              {timedMode && timeLimitSec ? ` / 限時 ${formatDuration(timeLimitSec)}` : ""}
            </p>
            {finishSaving ? (
              <p className="mt-2 text-sm text-[var(--muted)]">正在儲存測驗紀錄…</p>
            ) : finishSaved ? (
              <p className="mt-2 text-sm text-green-700">測驗紀錄已儲存</p>
            ) : finishError ? (
              <p className="mt-2 text-sm text-red-600">{finishError}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPhase("setup");
                  resetExamState();
                  setError(null);
                  setPoolNote(null);
                }}
                className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm text-white"
              >
                再測一次
              </button>
              <Link
                href="/regulations"
                className="rounded-md border border-[var(--border)] px-5 py-2 text-sm no-underline"
              >
                查法規／函釋
              </Link>
            </div>
          </div>
          {history}
        </>
      ) : null}
    </section>
  );
}
