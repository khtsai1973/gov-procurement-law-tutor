import OpenAI from "openai";

import { ensureDiagnosticsSchema } from "@/lib/ensure-diagnostics-schema";
import type {
  DiagnosticRegulation,
  ExamSessionDiagnosis,
  WrongQuestionBrief,
} from "@/lib/exam-diagnostics-types";
import { formatAnswerLabel } from "@/lib/mock-exam";
import prisma from "@/lib/prisma";
import { formatRagContext, retrieveForRag } from "@/lib/rag";

export type { DiagnosticRegulation, ExamSessionDiagnosis, WrongQuestionBrief } from "@/lib/exam-diagnostics-types";

/** 納入綜合診斷的錯題上限（控制 prompt／延遲） */
export const DIAGNOSE_MAX_WRONG = 10;

const DIAGNOSTIC_SYSTEM_PROMPT = `你是政府採購法規教學助教。學習者剛完成模擬考試，以下為其「答錯題目」清單與檢索到的法規／函釋全文片段。
請輸出繁體中文「綜合觀念診斷」，格式必須如下：

## 綜合觀念診斷
（3～8 句：歸納錯題共同迷思、關鍵要件與學習優先順序；勿逐題重複抄題）

## 逐題要點
（針對每一道錯題各 1～3 句：為何參考答案正確、本題容易錯在哪；以「第N題：」開頭）

## 建議補強法規
（條列 3～8 項；每項格式：- 《法規或函釋名稱》：一句複習理由。名稱須能對應檢索片段或題目相關法規，勿捏造條號／文號）

規則：
- 僅依檢索片段與錯題資料作答；片段未出現的條號、文號、金額數字不可寫出。
- 語氣清楚、適合作考後複習。`;

function parseRecommendationsJson(raw: string | null | undefined): DiagnosticRegulation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: DiagnosticRegulation[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (typeof r.slug !== "string" || typeof r.title !== "string") continue;
      out.push({
        slug: r.slug,
        title: r.title,
        sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : null,
        reason: typeof r.reason === "string" ? r.reason : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function extractPerQuestionNotes(summary: string, wrongIndexes: number[]): Map<number, string> {
  const map = new Map<number, string>();
  const section = summary.split(/##\s*逐題要點/)[1]?.split(/##\s*建議補強法規/)[0] ?? "";
  for (const idx of wrongIndexes) {
    const re = new RegExp(`第\\s*${idx + 1}\\s*題[:：]\\s*([^\\n]+(?:\\n(?!第\\s*\\d+\\s*題)[^\\n]+)*)`, "m");
    const m = section.match(re);
    if (m?.[1]) map.set(idx, m[1].trim());
  }
  return map;
}

function buildFallbackDiagnosis(params: {
  wrongs: WrongQuestionBrief[];
  regulations: DiagnosticRegulation[];
}): string {
  const cats = [...new Set(params.wrongs.map((w) => w.category))];
  const lines = [
    "## 綜合觀念診斷",
    `本場共答錯 ${params.wrongs.length} 題，主要落在：${cats.join("、") || "相關單元"}。`,
    "建議先釐清各題構成要件與適用範圍，再對照下方法規全文複習，避免僅背誦選項。",
    "",
    "## 逐題要點",
    ...params.wrongs.map(
      (w) =>
        `第${w.questionIndex + 1}題：類別「${w.category}」。您的答案為 ${formatAnswerLabel(w.userAnswer, "MULTIPLE_CHOICE")}，參考答案為 ${formatAnswerLabel(w.referenceAnswer, "MULTIPLE_CHOICE")}。請對照題意要件與相關法規。`,
    ),
    "",
    "## 建議補強法規",
    ...(params.regulations.length > 0
      ? params.regulations.map((r) => `- 《${r.title}》：建議複習與錯題相關之構成要件與程序規定。`)
      : ["- 請至本站「法規／函釋清單」依錯題關鍵詞查閱全文。"]),
  ];
  return lines.join("\n");
}

function mergeRegulations(
  fromChunks: DiagnosticRegulation[],
  fromRelated: DiagnosticRegulation[],
): DiagnosticRegulation[] {
  const seen = new Set<string>();
  const out: DiagnosticRegulation[] = [];
  for (const r of [...fromChunks, ...fromRelated]) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    out.push(r);
    if (out.length >= 10) break;
  }
  return out;
}

async function generateComprehensiveDiagnosis(params: {
  wrongs: WrongQuestionBrief[];
  questionType: string;
  relatedSlugs: string[];
}): Promise<{ summary: string; recommendations: DiagnosticRegulation[]; model: string }> {
  const probeParts = [
    "模擬考試錯題綜合診斷",
    ...params.wrongs.slice(0, 6).map(
      (w) =>
        `第${w.questionIndex + 1}題（${w.category}）：${w.question.slice(0, 220)}；學員答 ${formatAnswerLabel(w.userAnswer, params.questionType)}，正解 ${formatAnswerLabel(w.referenceAnswer, params.questionType)}`,
    ),
  ];
  const { chunks } = await retrieveForRag(probeParts.join("\n"), 8);

  const fromChunks: DiagnosticRegulation[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    if (seen.has(c.regulation.slug)) continue;
    seen.add(c.regulation.slug);
    fromChunks.push({
      slug: c.regulation.slug,
      title: c.regulation.title,
      sourceUrl: c.regulation.sourceUrl,
      reason: null,
    });
  }

  const relatedRegs =
    params.relatedSlugs.length > 0
      ? await prisma.regulation.findMany({
          where: { slug: { in: [...new Set(params.relatedSlugs)] } },
          select: { slug: true, title: true, sourceUrl: true },
        })
      : [];
  const fromRelated = relatedRegs.map((r) => ({
    slug: r.slug,
    title: r.title,
    sourceUrl: r.sourceUrl,
    reason: null as string | null,
  }));
  const recommendations = mergeRegulations(fromChunks, fromRelated);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const aiDisabled = process.env.OPENAI_DISABLED === "true" || process.env.OPENAI_DISABLED === "1";

  if (!apiKey || aiDisabled || chunks.length === 0) {
    return {
      summary: buildFallbackDiagnosis({ wrongs: params.wrongs, regulations: recommendations }),
      recommendations,
      model: !apiKey || aiDisabled ? "diagnostic-fallback" : "diagnostic-no-chunks",
    };
  }

  const wrongBlock = params.wrongs
    .map((w) => {
      const type = params.questionType;
      return [
        `### 第${w.questionIndex + 1}題`,
        `類別：${w.category}`,
        `題目：${w.question}`,
        `學員答案：${formatAnswerLabel(w.userAnswer, type)}`,
        `參考答案：${formatAnswerLabel(w.referenceAnswer, type)}`,
      ].join("\n");
    })
    .join("\n\n");

  const client = new OpenAI({ apiKey });
  const context = formatRagContext(chunks);

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: DIAGNOSTIC_SYSTEM_PROMPT },
        {
          role: "user",
          content: `以下為檢索片段：\n\n${context}\n\n---\n\n錯題清單：\n\n${wrongBlock}\n\n請輸出綜合觀念診斷、逐題要點與建議補強法規。`,
        },
      ],
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() ||
      buildFallbackDiagnosis({ wrongs: params.wrongs, regulations: recommendations });

    // 若 LLM 有寫出法規名稱，用 title 模糊對到 recommendation.reason
    const recSection = summary.split(/##\s*建議補強法規/)[1] ?? "";
    const enriched = recommendations.map((r) => {
      const line = recSection
        .split("\n")
        .find((l) => l.includes(r.title) || (r.title.length > 6 && l.includes(r.title.slice(0, 8))));
      const reason = line?.replace(/^[-*・]\s*/, "").replace(/^《[^》]+》[:：]?\s*/, "").trim();
      return { ...r, reason: reason || r.reason || null };
    });

    return {
      summary,
      recommendations: enriched,
      model: completion.model,
    };
  } catch (err) {
    console.error("[exam-diagnostics] OpenAI error:", err);
    return {
      summary: buildFallbackDiagnosis({ wrongs: params.wrongs, regulations: recommendations }),
      recommendations,
      model: "diagnostic-fallback",
    };
  }
}

export async function diagnoseMockExamSession(
  userId: string,
  sessionId: string,
  options?: { force?: boolean },
): Promise<ExamSessionDiagnosis> {
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
    return {
      sessionId,
      wrongCount: 0,
      summary: "本場沒有答錯題目，無需錯題診斷。可至學習儀表板複習弱項單元，或再測一次加深印象。",
      recommendations: [],
      wrongQuestions: [],
      model: "none",
      diagnosedAt: session.diagnosedAt?.toISOString() ?? null,
      alreadyDone: true,
    };
  }

  if (session.diagnosticSummary && !options?.force) {
    const keys = wrongAnswers.map((a) => a.itemKey);
    const items = await prisma.questionBankItem.findMany({
      where: { key: { in: keys } },
      select: { key: true, question: true, category: true },
    });
    const map = new Map(items.map((i) => [i.key, i]));
    return {
      sessionId,
      wrongCount: wrongAnswers.length,
      summary: session.diagnosticSummary,
      recommendations: parseRecommendationsJson(session.diagnosticRecommendations),
      wrongQuestions: wrongAnswers.map((a) => ({
        questionIndex: a.questionIndex,
        itemKey: a.itemKey,
        category: map.get(a.itemKey)?.category ?? "未分類",
        question: map.get(a.itemKey)?.question ?? a.itemKey,
        userAnswer: a.userAnswer,
        referenceAnswer: a.referenceAnswer,
        diagnosticNote: a.diagnosticNote,
      })),
      model: session.diagnosticModel ?? "cached",
      diagnosedAt: session.diagnosedAt?.toISOString() ?? null,
      alreadyDone: true,
    };
  }

  const targets = wrongAnswers.slice(0, DIAGNOSE_MAX_WRONG);
  const bankItems = await prisma.questionBankItem.findMany({
    where: { key: { in: targets.map((t) => t.itemKey) } },
  });
  const bankMap = new Map(bankItems.map((i) => [i.key, i]));

  const wrongs: WrongQuestionBrief[] = targets.map((a) => {
    const bank = bankMap.get(a.itemKey);
    return {
      questionIndex: a.questionIndex,
      itemKey: a.itemKey,
      category: bank?.category ?? "未分類",
      question: bank?.question ?? a.itemKey,
      userAnswer: a.userAnswer,
      referenceAnswer: a.referenceAnswer,
      diagnosticNote: null,
    };
  });

  const relatedSlugs = bankItems.flatMap((b) => b.relatedSlugs ?? []);
  const result = await generateComprehensiveDiagnosis({
    wrongs,
    questionType: session.questionType,
    relatedSlugs,
  });

  const noteMap = extractPerQuestionNotes(
    result.summary,
    wrongs.map((w) => w.questionIndex),
  );

  await prisma.$transaction([
    prisma.mockExamSession.update({
      where: { id: session.id },
      data: {
        diagnosticSummary: result.summary,
        diagnosticRecommendations: JSON.stringify(result.recommendations),
        diagnosticModel: result.model,
        diagnosedAt: new Date(),
      },
    }),
    ...targets.map((a) =>
      prisma.mockExamSessionAnswer.update({
        where: { id: a.id },
        data: { diagnosticNote: noteMap.get(a.questionIndex) ?? null },
      }),
    ),
  ]);

  return {
    sessionId,
    wrongCount: wrongAnswers.length,
    summary: result.summary,
    recommendations: result.recommendations,
    wrongQuestions: wrongs.map((w) => ({
      ...w,
      diagnosticNote: noteMap.get(w.questionIndex) ?? null,
    })),
    model: result.model,
    diagnosedAt: new Date().toISOString(),
    alreadyDone: false,
  };
}

export async function loadSessionDiagnosis(
  userId: string,
  sessionId: string,
): Promise<ExamSessionDiagnosis | null> {
  await ensureDiagnosticsSchema();

  const session = await prisma.mockExamSession.findFirst({
    where: { id: sessionId, userId, finishedAt: { not: null } },
    include: {
      answers: {
        where: { isCorrect: false },
        orderBy: { questionIndex: "asc" },
      },
    },
  });
  if (!session) return null;
  if (!session.diagnosticSummary) return null;

  const items = await prisma.questionBankItem.findMany({
    where: { key: { in: session.answers.map((a) => a.itemKey) } },
    select: { key: true, question: true, category: true },
  });
  const map = new Map(items.map((i) => [i.key, i]));

  return {
    sessionId,
    wrongCount: session.answers.length,
    summary: session.diagnosticSummary,
    recommendations: parseRecommendationsJson(session.diagnosticRecommendations),
    wrongQuestions: session.answers.map((a) => ({
      questionIndex: a.questionIndex,
      itemKey: a.itemKey,
      category: map.get(a.itemKey)?.category ?? "未分類",
      question: map.get(a.itemKey)?.question ?? a.itemKey,
      userAnswer: a.userAnswer,
      referenceAnswer: a.referenceAnswer,
      diagnosticNote: a.diagnosticNote,
    })),
    model: session.diagnosticModel ?? "cached",
    diagnosedAt: session.diagnosedAt?.toISOString() ?? null,
    alreadyDone: true,
  };
}
