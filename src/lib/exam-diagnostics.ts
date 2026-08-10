import OpenAI from "openai";

import { ensureDiagnosticsSchema } from "@/lib/ensure-diagnostics-schema";
import type {
  DiagnosticRegulation,
  ExamSessionDiagnosis,
  WrongQuestionBrief,
} from "@/lib/exam-diagnostics-types";
import {
  extractWrongReasonNotes,
  parseDiagnosticSections,
} from "@/lib/diagnostic-sections";
import {
  computeKnowledgeRadar,
  formatRadarForPrompt,
  type KnowledgeRadarSnapshot,
} from "@/lib/knowledge-radar";
import { resolveKnowledgeTags } from "@/lib/knowledge-tags";
import { formatAnswerLabel } from "@/lib/mock-exam";
import prisma from "@/lib/prisma";
import { formatRagContext, retrieveForRag } from "@/lib/rag";

export type {
  DiagnosticRegulation,
  ExamSessionDiagnosis,
  WrongQuestionBrief,
} from "@/lib/exam-diagnostics-types";
export { parseDiagnosticSections } from "@/lib/diagnostic-sections";

/** 納入綜合診斷的錯題上限（控制 prompt／延遲） */
export const DIAGNOSE_MAX_WRONG = 10;

const DIAGNOSTIC_SYSTEM_PROMPT = `你是政府採購法規教學助教。學習者剛完成模擬考試。
系統已用「確定性規則引擎」依錯題知識標籤算出雷達圖數值與弱點標籤；這些數字不可改寫或否定。

你的任務是結合題庫錯題與弱點標籤，產出「弱點分析」與「錯題原因分析」，格式必須如下：

## 弱點分析
（先 3～6 句總結本場弱點與學習優先順序；再針對每一個弱點標籤各 2～4 句補強指引，以「【標籤名】：」開頭）

## 錯題原因分析
（針對每一道錯題各 2～4 句：為何參考答案正確、學員答案錯在何處、常見陷阱；以「第N題：」開頭）

## 建議補強法規
（條列 3～8 項；每項格式：- 《法規或函釋名稱》：一句複習理由。名稱須能對應檢索片段或題目相關法規，勿捏造條號／文號）

規則：
- 雷達數值與弱點標籤以系統提供為準（Deterministic），你只負責語意化建議（Generative）。
- 僅依檢索片段與錯題資料作答；片段未出現的條號、文號、金額數字不可寫出。
- 語氣清楚、適合作考後複習；錯題原因須對照學員答案與參考答案。`;

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

function parseRadarJson(raw: string | null | undefined): KnowledgeRadarSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as KnowledgeRadarSnapshot;
    if (!parsed || !Array.isArray(parsed.axes)) return null;
    return {
      engine: "rule-v1",
      axes: parsed.axes,
      weakTags: Array.isArray(parsed.weakTags) ? parsed.weakTags.map(String) : [],
      strongTags: Array.isArray(parsed.strongTags) ? parsed.strongTags.map(String) : [],
    };
  } catch {
    return null;
  }
}

function buildFallbackDiagnosis(params: {
  wrongs: WrongQuestionBrief[];
  regulations: DiagnosticRegulation[];
  radar: KnowledgeRadarSnapshot;
}): string {
  const weak = params.radar.weakTags;
  const lines = [
    "## 弱點分析",
    `本場共答錯 ${params.wrongs.length} 題。依規則引擎雷達圖，弱點標籤為：${weak.join("、") || "相關單元"}。`,
    "建議先依弱點標籤釐清構成要件與適用範圍，再對照題庫錯題與法規全文複習，避免僅背誦選項。",
    "",
    ...(weak.length > 0
      ? weak.map(
          (t) =>
            `【${t}】：請複習該主題的法定要件、程序時點與常見例外；搭配錯題對照參考答案推理過程。`,
        )
      : ["【一般】：請依錯題類別複習對應法規單元。"]),
    "",
    "## 錯題原因分析",
    ...params.wrongs.map((w) => {
      const tags = w.knowledgeTags.join("、") || w.category;
      return `第${w.questionIndex + 1}題：知識標籤「${tags}」。您的答案為 ${formatAnswerLabel(w.userAnswer, "MULTIPLE_CHOICE")}，參考答案為 ${formatAnswerLabel(w.referenceAnswer, "MULTIPLE_CHOICE")}。請對照題意要件、排除易混淆選項，並回題庫完整教學解析複習。`;
    }),
    "",
    "## 建議補強法規",
    ...(params.regulations.length > 0
      ? params.regulations.map(
          (r) => `- 《${r.title}》：建議複習與弱點標籤／錯題相關之構成要件與程序規定。`,
        )
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

async function generateHybridAdvice(params: {
  wrongs: WrongQuestionBrief[];
  questionType: string;
  relatedSlugs: string[];
  radar: KnowledgeRadarSnapshot;
}): Promise<{ summary: string; recommendations: DiagnosticRegulation[]; model: string }> {
  const probeParts = [
    "模擬考試弱點診斷",
    `弱點標籤：${params.radar.weakTags.join("、")}`,
    ...params.wrongs.slice(0, 6).map(
      (w) =>
        `第${w.questionIndex + 1}題（${w.knowledgeTags.join("/") || w.category}）：${w.question.slice(0, 220)}`,
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
      summary: buildFallbackDiagnosis({
        wrongs: params.wrongs,
        regulations: recommendations,
        radar: params.radar,
      }),
      recommendations,
      model: !apiKey || aiDisabled ? "hybrid-fallback" : "hybrid-no-chunks",
    };
  }

  const wrongBlock = params.wrongs
    .map((w) => {
      const type = params.questionType;
      return [
        `### 第${w.questionIndex + 1}題`,
        `類別：${w.category}`,
        `知識標籤：${w.knowledgeTags.join("、") || "—"}`,
        `題目：${w.question}`,
        `學員答案：${formatAnswerLabel(w.userAnswer, type)}`,
        `參考答案：${formatAnswerLabel(w.referenceAnswer, type)}`,
      ].join("\n");
    })
    .join("\n\n");

  const client = new OpenAI({ apiKey });
  const context = formatRagContext(chunks);
  const radarBlock = formatRadarForPrompt(params.radar);

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: DIAGNOSTIC_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            "【確定性雷達圖（不可改寫）】",
            radarBlock,
            "",
            "【檢索片段】",
            context,
            "",
            "【錯題清單】",
            wrongBlock,
            "",
            "請輸出「弱點分析」「錯題原因分析」與「建議補強法規」。",
          ].join("\n"),
        },
      ],
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() ||
      buildFallbackDiagnosis({
        wrongs: params.wrongs,
        regulations: recommendations,
        radar: params.radar,
      });

    const recSection = summary.split(/##\s*建議補強法規/)[1] ?? "";
    const enriched = recommendations.map((r) => {
      const line = recSection
        .split("\n")
        .find((l) => l.includes(r.title) || (r.title.length > 6 && l.includes(r.title.slice(0, 8))));
      const reason = line
        ?.replace(/^[-*・]\s*/, "")
        .replace(/^《[^》]+》[:：]?\s*/, "")
        .trim();
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
      summary: buildFallbackDiagnosis({
        wrongs: params.wrongs,
        regulations: recommendations,
        radar: params.radar,
      }),
      recommendations,
      model: "hybrid-fallback",
    };
  }
}

async function buildRadarForSession(
  answers: Array<{ itemKey: string; isCorrect: boolean | null; revealed: boolean }>,
): Promise<KnowledgeRadarSnapshot> {
  const keys = [...new Set(answers.map((a) => a.itemKey))];
  const items = await prisma.questionBankItem.findMany({
    where: { key: { in: keys } },
    select: {
      key: true,
      category: true,
      keywords: true,
      relatedSlugs: true,
      question: true,
      knowledgeTags: true,
    },
  });
  const map = new Map(items.map((i) => [i.key, i]));
  return computeKnowledgeRadar(
    answers.map((a) => {
      const item = map.get(a.itemKey);
      return {
        isCorrect: a.isCorrect,
        revealed: a.revealed,
        tags: item
          ? resolveKnowledgeTags(item)
          : ["招標程序"],
      };
    }),
  );
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

  const radar =
    (!options?.force && parseRadarJson(session.diagnosticRadar)) ||
    (await buildRadarForSession(session.answers));

  const wrongAnswers = session.answers.filter((a) => a.isCorrect === false);
  if (wrongAnswers.length === 0) {
    const emptySummary =
      "本場沒有答錯題目，無需錯題診斷。可依雷達圖強項持續保持，或再測一次加深印象。";
    if (!session.diagnosticSummary || options?.force) {
      await prisma.mockExamSession.update({
        where: { id: session.id },
        data: {
          diagnosticSummary: emptySummary,
          diagnosticRecommendations: "[]",
          diagnosticModel: "none",
          diagnosticRadar: JSON.stringify(radar),
          diagnosedAt: new Date(),
        },
      });
    }
    return {
      sessionId,
      wrongCount: 0,
      summary: session.diagnosticSummary && !options?.force ? session.diagnosticSummary : emptySummary,
      recommendations: [],
      wrongQuestions: [],
      radar,
      model: "none",
      diagnosedAt: session.diagnosedAt?.toISOString() ?? new Date().toISOString(),
      alreadyDone: true,
    };
  }

  if (session.diagnosticSummary && !options?.force) {
    const keys = wrongAnswers.map((a) => a.itemKey);
    const items = await prisma.questionBankItem.findMany({
      where: { key: { in: keys } },
      select: {
        key: true,
        question: true,
        category: true,
        keywords: true,
        relatedSlugs: true,
        knowledgeTags: true,
      },
    });
    const map = new Map(items.map((i) => [i.key, i]));
    return {
      sessionId,
      wrongCount: wrongAnswers.length,
      summary: session.diagnosticSummary,
      recommendations: parseRecommendationsJson(session.diagnosticRecommendations),
      wrongQuestions: wrongAnswers.map((a) => {
        const bank = map.get(a.itemKey);
        return {
          questionIndex: a.questionIndex,
          itemKey: a.itemKey,
          category: bank?.category ?? "未分類",
          knowledgeTags: bank ? resolveKnowledgeTags(bank) : [],
          question: bank?.question ?? a.itemKey,
          userAnswer: a.userAnswer,
          referenceAnswer: a.referenceAnswer,
          diagnosticNote: a.diagnosticNote,
        };
      }),
      radar,
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
      knowledgeTags: bank ? resolveKnowledgeTags(bank) : [],
      question: bank?.question ?? a.itemKey,
      userAnswer: a.userAnswer,
      referenceAnswer: a.referenceAnswer,
      diagnosticNote: null,
    };
  });

  const relatedSlugs = bankItems.flatMap((b) => b.relatedSlugs ?? []);
  const result = await generateHybridAdvice({
    wrongs,
    questionType: session.questionType,
    relatedSlugs,
    radar,
  });

  const noteMap = extractWrongReasonNotes(
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
        diagnosticRadar: JSON.stringify(radar),
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
    radar,
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
        orderBy: { questionIndex: "asc" },
      },
    },
  });
  if (!session) return null;

  const radar =
    parseRadarJson(session.diagnosticRadar) ?? (await buildRadarForSession(session.answers));

  if (!session.diagnosticSummary) {
    return {
      sessionId,
      wrongCount: session.answers.filter((a) => a.isCorrect === false).length,
      summary: "",
      recommendations: [],
      wrongQuestions: [],
      radar,
      model: "pending",
      diagnosedAt: null,
      alreadyDone: false,
    };
  }

  const wrongAnswers = session.answers.filter((a) => a.isCorrect === false);
  const items = await prisma.questionBankItem.findMany({
    where: { key: { in: wrongAnswers.map((a) => a.itemKey) } },
    select: {
      key: true,
      question: true,
      category: true,
      keywords: true,
      relatedSlugs: true,
      knowledgeTags: true,
    },
  });
  const map = new Map(items.map((i) => [i.key, i]));

  return {
    sessionId,
    wrongCount: wrongAnswers.length,
    summary: session.diagnosticSummary,
    recommendations: parseRecommendationsJson(session.diagnosticRecommendations),
    wrongQuestions: wrongAnswers.map((a) => {
      const bank = map.get(a.itemKey);
      return {
        questionIndex: a.questionIndex,
        itemKey: a.itemKey,
        category: bank?.category ?? "未分類",
        knowledgeTags: bank ? resolveKnowledgeTags(bank) : [],
        question: bank?.question ?? a.itemKey,
        userAnswer: a.userAnswer,
        referenceAnswer: a.referenceAnswer,
        diagnosticNote: a.diagnosticNote,
      };
    }),
    radar,
    model: session.diagnosticModel ?? "cached",
    diagnosedAt: session.diagnosedAt?.toISOString() ?? null,
    alreadyDone: true,
  };
}
