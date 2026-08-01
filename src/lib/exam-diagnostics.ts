import OpenAI from "openai";

import {
  formatAnswerLabel,
  inferMockExamQuestionType,
  type MockExamQuestionType,
} from "@/lib/mock-exam";
import { ensureDiagnosticsSchema } from "@/lib/ensure-diagnostics-schema";
import type { DiagnosticRegulation, ExamDiagnosticItem } from "@/lib/exam-diagnostics-types";
import prisma from "@/lib/prisma";
import { formatRagContext, retrieveForRag } from "@/lib/rag";

export type { DiagnosticRegulation, ExamDiagnosticItem } from "@/lib/exam-diagnostics-types";

export const DIAGNOSE_MAX_WRONG = 6;

const DIAGNOSTIC_SYSTEM_PROMPT = `你是政府採購法規教學助教。使用者剛完成模擬考試並答錯本題。
請依檢索到的法規／函釋全文片段，輸出繁體中文診斷，格式必須如下：

## 觀念釐清
（2～5 句：說明為何正確答案正確、常見迷思、與本題關鍵要件）

## 補強條文
（條列 2～5 項建議複習的法規／條文／函釋要點；須能對應片段內容，勿捏造條號或文號）

規則：
- 僅依片段作答；片段未出現的條號、文號、金額數字不可寫出。
- 勿輸出與本題無關的內容。
- 語氣清楚、適合作考後複習。`;

function parseSourcesJson(raw: string | null | undefined): DiagnosticRegulation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const r = row as Record<string, unknown>;
        if (typeof r.slug !== "string" || typeof r.title !== "string") return null;
        return {
          slug: r.slug,
          title: r.title,
          sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : null,
        };
      })
      .filter((r): r is DiagnosticRegulation => r !== null);
  } catch {
    return [];
  }
}

function buildFallbackClarification(params: {
  category: string;
  hintAnswer: string | null;
  userLabel: string;
  refLabel: string;
  regulations: DiagnosticRegulation[];
}): string {
  const lines = [
    "## 觀念釐清",
    `本題屬「${params.category}」。您的答案為 ${params.userLabel}，參考答案為 ${params.refLabel}。`,
    params.hintAnswer?.trim()
      ? `題庫導引：${params.hintAnswer.trim()}`
      : "請對照下方補強法規全文，釐清構成要件與適用範圍。",
    "",
    "## 補強條文",
  ];
  if (params.regulations.length === 0) {
    lines.push("- 請至法規／函釋清單依本題關鍵詞進一步查閱。");
  } else {
    for (const r of params.regulations) {
      lines.push(`- 《${r.title}》`);
    }
  }
  return lines.join("\n");
}

async function generateOneDiagnostic(params: {
  question: string;
  category: string;
  questionType: MockExamQuestionType | null;
  userAnswer: string | null;
  referenceAnswer: string | null;
  hintAnswer: string | null;
  relatedSlugs: string[];
}): Promise<{ clarification: string; regulations: DiagnosticRegulation[]; model: string }> {
  const userLabel = formatAnswerLabel(params.userAnswer, params.questionType ?? "MULTIPLE_CHOICE");
  const refLabel = formatAnswerLabel(
    params.referenceAnswer,
    params.questionType ?? "MULTIPLE_CHOICE",
  );

  const relatedRegs = params.relatedSlugs.length
    ? await prisma.regulation.findMany({
        where: { slug: { in: params.relatedSlugs } },
        select: { slug: true, title: true, sourceUrl: true },
      })
    : [];

  const probe = [
    params.question.slice(0, 400),
    `類別：${params.category}`,
    `為何參考答案是 ${refLabel} 而非 ${userLabel}？請說明關鍵觀念。`,
  ].join("\n");

  const { chunks } = await retrieveForRag(probe, 6);

  const fromChunks: DiagnosticRegulation[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    if (seen.has(c.regulation.slug)) continue;
    seen.add(c.regulation.slug);
    fromChunks.push({
      slug: c.regulation.slug,
      title: c.regulation.title,
      sourceUrl: c.regulation.sourceUrl,
    });
  }
  for (const r of relatedRegs) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    fromChunks.push(r);
  }
  const regulations = fromChunks.slice(0, 8);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const aiDisabled = process.env.OPENAI_DISABLED === "true" || process.env.OPENAI_DISABLED === "1";

  if (!apiKey || aiDisabled || chunks.length === 0) {
    return {
      clarification: buildFallbackClarification({
        category: params.category,
        hintAnswer: params.hintAnswer,
        userLabel,
        refLabel,
        regulations,
      }),
      regulations,
      model: !apiKey || aiDisabled ? "diagnostic-fallback" : "diagnostic-no-chunks",
    };
  }

  const client = new OpenAI({ apiKey });
  const context = formatRagContext(chunks);
  const bankNote = params.hintAnswer?.trim()
    ? `\n題庫導引：${params.hintAnswer.trim()}`
    : "";

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: DIAGNOSTIC_SYSTEM_PROMPT },
        {
          role: "user",
          content: `以下為檢索片段：\n\n${context}\n\n---\n\n錯題資料：\n類別：${params.category}\n題目：${params.question}\n學員答案：${userLabel}\n參考答案：${refLabel}${bankNote}\n\n請輸出觀念釐清與補強條文。`,
        },
      ],
    });
    const clarification =
      completion.choices[0]?.message?.content?.trim() ||
      buildFallbackClarification({
        category: params.category,
        hintAnswer: params.hintAnswer,
        userLabel,
        refLabel,
        regulations,
      });
    return { clarification, regulations, model: completion.model };
  } catch (err) {
    console.error("[exam-diagnostics] OpenAI error:", err);
    return {
      clarification: buildFallbackClarification({
        category: params.category,
        hintAnswer: params.hintAnswer,
        userLabel,
        refLabel,
        regulations,
      }),
      regulations,
      model: "diagnostic-fallback",
    };
  }
}

export async function diagnoseMockExamSession(
  userId: string,
  sessionId: string,
  options?: { force?: boolean },
): Promise<{
  items: ExamDiagnosticItem[];
  skipped: number;
  alreadyDone: boolean;
}> {
  await ensureDiagnosticsSchema();

  const session = await prisma.mockExamSession.findFirst({
    where: { id: sessionId, userId, finishedAt: { not: null } },
    include: { answers: { orderBy: { questionIndex: "asc" } } },
  });
  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const wrongAnswers = session.answers.filter((a) => a.isCorrect === false);
  if (wrongAnswers.length === 0) {
    return { items: [], skipped: 0, alreadyDone: true };
  }

  const pending = options?.force
    ? wrongAnswers
    : wrongAnswers.filter((a) => !a.diagnosticText);
  const alreadyDone = pending.length === 0;

  const targets = pending.slice(0, DIAGNOSE_MAX_WRONG);
  const skipped = Math.max(0, pending.length - targets.length);

  if (targets.length === 0) {
    const cached = wrongAnswers
      .filter((a) => a.diagnosticText)
      .map((a) => ({
        answerId: a.id,
        questionIndex: a.questionIndex,
        itemKey: a.itemKey,
        category: "",
        question: "",
        userAnswer: a.userAnswer,
        referenceAnswer: a.referenceAnswer,
        clarification: a.diagnosticText!,
        regulations: parseSourcesJson(a.diagnosticSources),
        model: a.diagnosticModel ?? "cached",
      }));

    const keys = cached.map((c) => c.itemKey);
    const items = await prisma.questionBankItem.findMany({
      where: { key: { in: keys } },
      select: { key: true, question: true, category: true },
    });
    const map = new Map(items.map((i) => [i.key, i]));
    return {
      items: cached.map((c) => ({
        ...c,
        category: map.get(c.itemKey)?.category ?? "未分類",
        question: map.get(c.itemKey)?.question ?? c.itemKey,
      })),
      skipped: 0,
      alreadyDone: true,
    };
  }

  const bankItems = await prisma.questionBankItem.findMany({
    where: { key: { in: targets.map((t) => t.itemKey) } },
  });
  const bankMap = new Map(bankItems.map((i) => [i.key, i]));

  const items: ExamDiagnosticItem[] = [];

  for (const answer of targets) {
    const bank = bankMap.get(answer.itemKey);
    const questionType = bank ? inferMockExamQuestionType(bank) : null;
    const result = await generateOneDiagnostic({
      question: bank?.question ?? answer.itemKey,
      category: bank?.category ?? "未分類",
      questionType,
      userAnswer: answer.userAnswer,
      referenceAnswer: answer.referenceAnswer,
      hintAnswer: bank?.hintAnswer ?? null,
      relatedSlugs: bank?.relatedSlugs ?? [],
    });

    await prisma.mockExamSessionAnswer.update({
      where: { id: answer.id },
      data: {
        diagnosticText: result.clarification,
        diagnosticModel: result.model,
        diagnosticSources: JSON.stringify(result.regulations),
        diagnosedAt: new Date(),
      },
    });

    items.push({
      answerId: answer.id,
      questionIndex: answer.questionIndex,
      itemKey: answer.itemKey,
      category: bank?.category ?? "未分類",
      question: bank?.question ?? answer.itemKey,
      userAnswer: answer.userAnswer,
      referenceAnswer: answer.referenceAnswer,
      clarification: result.clarification,
      regulations: result.regulations,
      model: result.model,
    });
  }

  // Include previously cached diagnostics for the same session
  if (!options?.force) {
    const cachedOthers = wrongAnswers.filter(
      (a) => a.diagnosticText && !targets.some((t) => t.id === a.id),
    );
    if (cachedOthers.length > 0) {
      const keys = cachedOthers.map((a) => a.itemKey);
      const extraItems = await prisma.questionBankItem.findMany({
        where: { key: { in: keys } },
        select: { key: true, question: true, category: true },
      });
      const map = new Map(extraItems.map((i) => [i.key, i]));
      for (const a of cachedOthers) {
        items.push({
          answerId: a.id,
          questionIndex: a.questionIndex,
          itemKey: a.itemKey,
          category: map.get(a.itemKey)?.category ?? "未分類",
          question: map.get(a.itemKey)?.question ?? a.itemKey,
          userAnswer: a.userAnswer,
          referenceAnswer: a.referenceAnswer,
          clarification: a.diagnosticText!,
          regulations: parseSourcesJson(a.diagnosticSources),
          model: a.diagnosticModel ?? "cached",
        });
      }
    }
  }

  items.sort((a, b) => a.questionIndex - b.questionIndex);
  return { items, skipped, alreadyDone };
}

export async function loadSessionDiagnostics(
  userId: string,
  sessionId: string,
): Promise<ExamDiagnosticItem[]> {
  await ensureDiagnosticsSchema();

  const session = await prisma.mockExamSession.findFirst({
    where: { id: sessionId, userId, finishedAt: { not: null } },
    include: {
      answers: {
        where: { isCorrect: false, diagnosticText: { not: null } },
        orderBy: { questionIndex: "asc" },
      },
    },
  });
  if (!session || session.answers.length === 0) return [];

  const bankItems = await prisma.questionBankItem.findMany({
    where: { key: { in: session.answers.map((a) => a.itemKey) } },
    select: { key: true, question: true, category: true },
  });
  const map = new Map(bankItems.map((i) => [i.key, i]));

  return session.answers.map((a) => ({
    answerId: a.id,
    questionIndex: a.questionIndex,
    itemKey: a.itemKey,
    category: map.get(a.itemKey)?.category ?? "未分類",
    question: map.get(a.itemKey)?.question ?? a.itemKey,
    userAnswer: a.userAnswer,
    referenceAnswer: a.referenceAnswer,
    clarification: a.diagnosticText!,
    regulations: parseSourcesJson(a.diagnosticSources),
    model: a.diagnosticModel ?? "cached",
  }));
}
