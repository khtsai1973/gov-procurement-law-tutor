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
  formatCoreStrengths,
  formatKeyWeaknesses,
  formatRadarForPrompt,
  type KnowledgeRadarSnapshot,
} from "@/lib/knowledge-radar";
import { resolveAllQuestionTags, resolveKnowledgeTags } from "@/lib/knowledge-tags";
import { formatAnswerLabel } from "@/lib/mock-exam";
import {
  buildPersonalWeaknessReport,
  collectWrongConceptTags,
  parseDiagnosisBundle,
  PERSONAL_WEAKNESS_REPORT_TITLE,
  pickPracticeQuestionsByTags,
  stringifyDiagnosisBundle,
  type PracticeQuestionBrief,
} from "@/lib/personal-weakness-report";
import prisma from "@/lib/prisma";
import { formatRagContext, retrieveForRag } from "@/lib/rag";

export type {
  DiagnosticRegulation,
  ExamSessionDiagnosis,
  WrongQuestionBrief,
} from "@/lib/exam-diagnostics-types";
export { parseDiagnosticSections } from "@/lib/diagnostic-sections";
export type { PracticeQuestionBrief, PersonalWeaknessReport } from "@/lib/personal-weakness-report";

/** 納入綜合診斷的錯題上限（控制 prompt／延遲） */
export const DIAGNOSE_MAX_WRONG = 10;

/** 行動建議：補強法規連結數 */
const ACTION_REG_LIMIT = 3;
/** 行動建議：精準練習題數 */
const ACTION_PRACTICE_LIMIT = 2;

const DIAGNOSTIC_SYSTEM_PROMPT = `你是政府採購法規教學助教，負責學習者知識追蹤（Learner Knowledge Tracing）。
學習者剛完成模擬考試。系統已用「確定性規則引擎」依題目知識標籤算出能力矩陣（雷達）與核心強項／關鍵弱點；這些數字不可改寫或否定。

請依錯題標籤（含條次款項與概念詞）做知識圖譜式分析，產出《${PERSONAL_WEAKNESS_REPORT_TITLE}》，格式必須如下：

## 核心強項
（條列正確率 ≥ 85% 的主題；可改寫為通順中文，但正確率數字須與系統一致。若系統顯示無強項，寫「本場尚無正確率達 85% 的主題」。）

## 關鍵弱點
（先 2～4 句總結知識缺口與優先順序；再針對弱點標籤／錯題概念各 1～3 句，以「【標籤名】：」開頭。正確率數字不可改寫。）

## 行動建議
（必須包含：
1. 恰好 3 條針對性補強法條／法規複習方向（對應檢索片段或題目相關法規，格式：- 《法規名稱》：一句理由）；
2. 說明為何需針對弱點標籤練習（1～2 句）。
實際練習題由系統另附，你不必編造題號。）

## 錯題原因分析
（針對每一道錯題各 2～4 句：為何參考答案正確、學員答案錯在何處、常見陷阱；以「第N題：」開頭）

規則：
- 雷達數值與標籤以系統提供為準（Deterministic），你只負責語意化診斷（Generative）。
- 僅依檢索片段與錯題資料作答；片段未出現的條號、文號、金額數字不可寫出（錯題標籤已列之條次可引用）。
- 語氣清楚、適合作考後複習。`;

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
  wrongConceptTags: string[];
  practiceQuestions: PracticeQuestionBrief[];
}): string {
  const strengths = formatCoreStrengths(params.radar);
  const weaks = formatKeyWeaknesses(params.radar);
  const conceptExtra = params.wrongConceptTags.filter(
    (t) => !params.radar.axes.some((a) => String(a.tag) === t),
  );
  const lines = [
    `# 《${PERSONAL_WEAKNESS_REPORT_TITLE}》`,
    "",
    "## 核心強項",
    strengths.length > 0
      ? strengths.map((s) => `- ${s}`).join("\n")
      : "本場尚無正確率達 85% 的主題。",
    "",
    "## 關鍵弱點",
    `本場共答錯 ${params.wrongs.length} 題。依能力矩陣，關鍵弱點為：${weaks.join("、") || "相關單元"}。`,
    conceptExtra.length > 0
      ? `錯題概念／條次標籤：${conceptExtra.slice(0, 8).join("、")}。`
      : "",
    "建議先依弱點標籤釐清構成要件與適用範圍，再對照題庫錯題與法規全文複習。",
    "",
    ...(weaks.length > 0
      ? weaks.slice(0, 5).map((t) => {
          const name = t.replace(/（正確率.*$/, "");
          return `【${name}】：請複習該主題的法定要件、程序時點與常見例外；搭配錯題對照參考答案推理過程。`;
        })
      : ["【一般】：請依錯題類別複習對應法規單元。"]),
    "",
    "## 行動建議",
    ...params.regulations.slice(0, ACTION_REG_LIMIT).map(
      (r) => `- 《${r.title}》：建議複習與弱點標籤／錯題相關之構成要件與程序規定。`,
    ),
    ...(params.regulations.length === 0
      ? ["- 請至本站「法規／函釋清單」依錯題關鍵詞查閱全文。"]
      : []),
    params.practiceQuestions.length > 0
      ? `系統已依弱點標籤推薦 ${params.practiceQuestions.length} 道精準練習題，請至診斷結果頁作答。`
      : "請至題庫依弱點類別篩選重要題練習。",
    "",
    "## 錯題原因分析",
    ...params.wrongs.map((w) => {
      const tags = w.knowledgeTags.join("、") || w.category;
      return `第${w.questionIndex + 1}題：知識標籤「${tags}」。您的答案為 ${formatAnswerLabel(w.userAnswer, "MULTIPLE_CHOICE")}，參考答案為 ${formatAnswerLabel(w.referenceAnswer, "MULTIPLE_CHOICE")}。請對照題意要件、排除易混淆選項，並回題庫完整教學解析複習。`;
    }),
  ];
  return lines.filter((l) => l !== "").join("\n");
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
    if (out.length >= ACTION_REG_LIMIT) break;
  }
  return out;
}

function bankSelectFields() {
  return {
    key: true,
    question: true,
    category: true,
    keywords: true,
    relatedSlugs: true,
    knowledgeTags: true,
  } as const;
}

async function generateHybridAdvice(params: {
  wrongs: WrongQuestionBrief[];
  questionType: string;
  relatedSlugs: string[];
  radar: KnowledgeRadarSnapshot;
  wrongConceptTags: string[];
  practiceQuestions: PracticeQuestionBrief[];
}): Promise<{
  summary: string;
  recommendations: DiagnosticRegulation[];
  practiceQuestions: PracticeQuestionBrief[];
  model: string;
}> {
  const probeParts = [
    "模擬考試個人化學習弱點診斷",
    `弱點標籤：${params.radar.weakTags.join("、")}`,
    `錯題概念標籤：${params.wrongConceptTags.join("、")}`,
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
        wrongConceptTags: params.wrongConceptTags,
        practiceQuestions: params.practiceQuestions,
      }),
      recommendations,
      practiceQuestions: params.practiceQuestions,
      model: !apiKey || aiDisabled ? "hybrid-fallback" : "hybrid-no-chunks",
    };
  }

  const wrongBlock = params.wrongs
    .map((w) => {
      const type = params.questionType;
      return [
        `### 第${w.questionIndex + 1}題`,
        `類別：${w.category}`,
        `知識／概念標籤：${w.knowledgeTags.join("、") || "—"}`,
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
            `請產出《${PERSONAL_WEAKNESS_REPORT_TITLE}》。`,
            "",
            "【確定性能力矩陣（不可改寫）】",
            radarBlock,
            "",
            `系統核心強項：${formatCoreStrengths(params.radar).join("；") || "無"}`,
            `系統關鍵弱點：${formatKeyWeaknesses(params.radar).join("；") || "無"}`,
            `錯題概念／條次標籤：${params.wrongConceptTags.join("、") || "無"}`,
            "",
            "【檢索片段】",
            context,
            "",
            "【錯題清單】",
            wrongBlock,
            "",
            "請輸出「核心強項」「關鍵弱點」「行動建議」與「錯題原因分析」。",
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
        wrongConceptTags: params.wrongConceptTags,
        practiceQuestions: params.practiceQuestions,
      });

    const sections = parseDiagnosticSections(summary);
    const recSection = sections.actionAdvice || sections.regulationAdvice || "";
    const enriched = recommendations.map((r) => {
      const line = recSection
        .split("\n")
        .find((l) => l.includes(r.title) || (r.title.length > 6 && l.includes(r.title.slice(0, 8))));
      const reason = line
        ?.replace(/^[-*・\d.、)\s]*/, "")
        .replace(/^《[^》]+》[:：]?\s*/, "")
        .trim();
      return { ...r, reason: reason || r.reason || null };
    });

    return {
      summary,
      recommendations: enriched.slice(0, ACTION_REG_LIMIT),
      practiceQuestions: params.practiceQuestions,
      model: completion.model,
    };
  } catch (err) {
    console.error("[exam-diagnostics] OpenAI error:", err);
    return {
      summary: buildFallbackDiagnosis({
        wrongs: params.wrongs,
        regulations: recommendations,
        radar: params.radar,
        wrongConceptTags: params.wrongConceptTags,
        practiceQuestions: params.practiceQuestions,
      }),
      recommendations,
      practiceQuestions: params.practiceQuestions,
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
    select: bankSelectFields(),
  });
  const map = new Map(items.map((i) => [i.key, i]));
  return computeKnowledgeRadar(
    answers.map((a) => {
      const item = map.get(a.itemKey);
      return {
        isCorrect: a.isCorrect,
        revealed: a.revealed,
        tags: item ? resolveKnowledgeTags(item) : ["招標程序"],
      };
    }),
  );
}

async function loadPracticeCandidates(
  weakTags: string[],
  excludeKeys: string[],
): Promise<PracticeQuestionBrief[]> {
  if (weakTags.length === 0) return [];
  const exclude = new Set(excludeKeys);
  // 取較多候選再依標籤重疊排序
  const candidates = await prisma.questionBankItem.findMany({
    take: 80,
    orderBy: { updatedAt: "desc" },
    select: {
      key: true,
      category: true,
      question: true,
      keywords: true,
      relatedSlugs: true,
      knowledgeTags: true,
    },
  });
  return pickPracticeQuestionsByTags({
    candidates,
    weakTags,
    excludeKeys: exclude,
    limit: ACTION_PRACTICE_LIMIT,
  });
}

function toWrongBrief(
  a: { questionIndex: number; itemKey: string; userAnswer: string | null; referenceAnswer: string | null; diagnosticNote?: string | null },
  bank:
    | {
        category: string;
        question: string;
        keywords?: string[] | null;
        relatedSlugs?: string[] | null;
        knowledgeTags?: string[] | null;
      }
    | undefined,
): WrongQuestionBrief {
  return {
    questionIndex: a.questionIndex,
    itemKey: a.itemKey,
    category: bank?.category ?? "未分類",
    knowledgeTags: bank ? resolveAllQuestionTags(bank) : [],
    question: bank?.question ?? a.itemKey,
    userAnswer: a.userAnswer,
    referenceAnswer: a.referenceAnswer,
    diagnosticNote: a.diagnosticNote ?? null,
  };
}

function attachPersonalReport(params: {
  radar: KnowledgeRadarSnapshot;
  wrongs: WrongQuestionBrief[];
  recommendations: DiagnosticRegulation[];
  practiceQuestions: PracticeQuestionBrief[];
}) {
  const wrongConceptTags = collectWrongConceptTags(
    params.wrongs.map((w) => ({
      category: w.category,
      question: w.question,
      knowledgeTags: w.knowledgeTags,
    })),
  );
  return buildPersonalWeaknessReport({
    radar: params.radar,
    wrongConceptTags,
    regulations: params.recommendations,
    practiceQuestions: params.practiceQuestions,
  });
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
      "本場沒有答錯題目，無需錯題診斷。可依能力矩陣強項持續保持，或再測一次加深印象。";
    if (!session.diagnosticSummary || options?.force) {
      await prisma.mockExamSession.update({
        where: { id: session.id },
        data: {
          diagnosticSummary: emptySummary,
          diagnosticRecommendations: stringifyDiagnosisBundle({
            regulations: [],
            practiceQuestions: [],
          }),
          diagnosticModel: "none",
          diagnosticRadar: JSON.stringify(radar),
          diagnosedAt: new Date(),
        },
      });
    }
    const personalReport = buildPersonalWeaknessReport({
      radar,
      wrongConceptTags: [],
      regulations: [],
      practiceQuestions: [],
    });
    return {
      sessionId,
      wrongCount: 0,
      summary: session.diagnosticSummary && !options?.force ? session.diagnosticSummary : emptySummary,
      recommendations: [],
      practiceQuestions: [],
      personalReport,
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
      select: bankSelectFields(),
    });
    const map = new Map(items.map((i) => [i.key, i]));
    const bundle = parseDiagnosisBundle(session.diagnosticRecommendations);
    const wrongQuestions = wrongAnswers.map((a) => toWrongBrief(a, map.get(a.itemKey)));
    return {
      sessionId,
      wrongCount: wrongAnswers.length,
      summary: session.diagnosticSummary,
      recommendations: bundle.regulations.slice(0, ACTION_REG_LIMIT),
      practiceQuestions: bundle.practiceQuestions.slice(0, ACTION_PRACTICE_LIMIT),
      personalReport: attachPersonalReport({
        radar,
        wrongs: wrongQuestions,
        recommendations: bundle.regulations,
        practiceQuestions: bundle.practiceQuestions,
      }),
      wrongQuestions,
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

  const wrongs: WrongQuestionBrief[] = targets.map((a) => toWrongBrief(a, bankMap.get(a.itemKey)));
  const wrongConceptTags = collectWrongConceptTags(
    wrongs.map((w) => {
      const bank = bankMap.get(w.itemKey);
      return {
        category: w.category,
        question: w.question,
        keywords: bank?.keywords,
        knowledgeTags: bank?.knowledgeTags,
      };
    }),
  );

  const excludeKeys = session.answers.map((a) => a.itemKey);
  const practiceQuestions = await loadPracticeCandidates(
    [...radar.weakTags, ...wrongConceptTags].slice(0, 12),
    excludeKeys,
  );

  const relatedSlugs = bankItems.flatMap((b) => b.relatedSlugs ?? []);
  const result = await generateHybridAdvice({
    wrongs,
    questionType: session.questionType,
    relatedSlugs,
    radar,
    wrongConceptTags,
    practiceQuestions,
  });

  const noteMap = extractWrongReasonNotes(
    result.summary,
    wrongs.map((w) => w.questionIndex),
  );

  const recommendations = result.recommendations.slice(0, ACTION_REG_LIMIT);
  const practices = result.practiceQuestions.slice(0, ACTION_PRACTICE_LIMIT);

  await prisma.$transaction([
    prisma.mockExamSession.update({
      where: { id: session.id },
      data: {
        diagnosticSummary: result.summary,
        diagnosticRecommendations: stringifyDiagnosisBundle({
          regulations: recommendations,
          practiceQuestions: practices,
        }),
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

  const wrongQuestions = wrongs.map((w) => ({
    ...w,
    diagnosticNote: noteMap.get(w.questionIndex) ?? null,
  }));

  return {
    sessionId,
    wrongCount: wrongAnswers.length,
    summary: result.summary,
    recommendations,
    practiceQuestions: practices,
    personalReport: attachPersonalReport({
      radar,
      wrongs: wrongQuestions,
      recommendations,
      practiceQuestions: practices,
    }),
    wrongQuestions,
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
      practiceQuestions: [],
      personalReport: buildPersonalWeaknessReport({
        radar,
        wrongConceptTags: [],
        regulations: [],
        practiceQuestions: [],
      }),
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
    select: bankSelectFields(),
  });
  const map = new Map(items.map((i) => [i.key, i]));
  const bundle = parseDiagnosisBundle(session.diagnosticRecommendations);
  const wrongQuestions = wrongAnswers.map((a) => toWrongBrief(a, map.get(a.itemKey)));

  return {
    sessionId,
    wrongCount: wrongAnswers.length,
    summary: session.diagnosticSummary,
    recommendations: bundle.regulations.slice(0, ACTION_REG_LIMIT),
    practiceQuestions: bundle.practiceQuestions.slice(0, ACTION_PRACTICE_LIMIT),
    personalReport: attachPersonalReport({
      radar,
      wrongs: wrongQuestions,
      recommendations: bundle.regulations,
      practiceQuestions: bundle.practiceQuestions,
    }),
    wrongQuestions,
    radar,
    model: session.diagnosticModel ?? "cached",
    diagnosedAt: session.diagnosedAt?.toISOString() ?? null,
    alreadyDone: true,
  };
}
