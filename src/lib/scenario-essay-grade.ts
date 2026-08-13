/**
 * 階段 3：採購實務情境申論題 — Rubric-Based LLM Grading
 *
 * 評分規準：
 * - 法條引用正確性 30%
 * - 處置程序合法性 40%
 * - 邏輯連貫與公文用語 30%
 *
 * 輸出：JSON（得分、扣分項、優點、修正後示範回答）
 */

import OpenAI from "openai";

import {
  getScenarioEssayQuestion,
  type ScenarioEssayQuestion,
} from "@/lib/scenario-essay-bank";
import {
  RUBRIC_WEIGHTS,
  type RubricDimensionScore,
  type ScenarioEssayGradeError,
  type ScenarioEssayGradeResult,
} from "@/lib/scenario-essay-types";
import { formatRagContext, retrieveForRag } from "@/lib/rag";

export type {
  RubricDimensionKey,
  RubricDimensionScore,
  ScenarioEssayGradeError,
  ScenarioEssayGradeResult,
} from "@/lib/scenario-essay-types";
export { RUBRIC_WEIGHTS } from "@/lib/scenario-essay-types";

export const SCENARIO_ESSAY_GRADING_SYSTEM = `你是政府採購法規教學助教，負責「開放式採購情境申論題」的嚴格批改。

## Grading Rubric（評分規準，分數必須嚴格遵守權重上限）

1. 法條引用正確性（最高 ${RUBRIC_WEIGHTS.citation} 分，佔 30%）
   - 條號／規範層級是否正確、是否張冠李戴、是否把契約要點誤當法律罰則公式。
2. 處置程序合法性（最高 ${RUBRIC_WEIGHTS.procedure} 分，佔 40%）
   - 步驟是否合法、順序是否合理、有無遺漏催告／通知／可歸責性判斷／救濟告知等關鍵程序。
3. 邏輯連貫與公文用語（最高 ${RUBRIC_WEIGHTS.coherence} 分，佔 30%）
   - 論述是否前後一致、用語是否接近機關公文／簽核語氣（簡潔、中性、避免口語與情緒字眼）。

## 規則
- 僅依「檢索片段」、題目「評分焦點」與學員作答評分；片段未出現的條號、文號、金額數字不可當成已證實事實寫進示範回答（評分焦點已列者可引用）。
- 總分 = 三維度分數之和（0～100）。
- 空作答或明顯離題：各維度給低分並在 deductions 說明。
- 必須只輸出一個 JSON 物件（不要 Markdown 圍欄、不要前言後語），欄位如下：
{
  "scores": {
    "citation": { "score": 0-${RUBRIC_WEIGHTS.citation}, "max": ${RUBRIC_WEIGHTS.citation}, "comment": "…" },
    "procedure": { "score": 0-${RUBRIC_WEIGHTS.procedure}, "max": ${RUBRIC_WEIGHTS.procedure}, "comment": "…" },
    "coherence": { "score": 0-${RUBRIC_WEIGHTS.coherence}, "max": ${RUBRIC_WEIGHTS.coherence}, "comment": "…" }
  },
  "total": 0-100,
  "deductions": ["扣分項1", "扣分項2"],
  "strengths": ["優點1", "優點2"],
  "modelAnswer": "修正後示範回答（完整、可直接作為複習範本）"
}`;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function asDim(
  raw: unknown,
  max: number,
  fallbackComment: string,
): RubricDimensionScore {
  if (!raw || typeof raw !== "object") {
    return { score: 0, max, comment: fallbackComment };
  }
  const o = raw as Record<string, unknown>;
  return {
    score: clamp(Number(o.score), 0, max),
    max,
    comment: typeof o.comment === "string" && o.comment.trim() ? o.comment.trim() : fallbackComment,
  };
}

function asStringList(raw: unknown, limit: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, limit);
}

/** 自 LLM 回覆擷取 JSON（容忍意外的 code fence） */
export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeGradePayload(
  raw: unknown,
  question: ScenarioEssayQuestion,
): Omit<ScenarioEssayGradeResult, "ok" | "questionId" | "model" | "fallback"> {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const scoresRaw =
    obj.scores && typeof obj.scores === "object"
      ? (obj.scores as Record<string, unknown>)
      : {};

  const citation = asDim(scoresRaw.citation, RUBRIC_WEIGHTS.citation, "法條引用評分");
  const procedure = asDim(scoresRaw.procedure, RUBRIC_WEIGHTS.procedure, "程序合法性評分");
  const coherence = asDim(scoresRaw.coherence, RUBRIC_WEIGHTS.coherence, "邏輯與用語評分");

  const sum = citation.score + procedure.score + coherence.score;
  const total = clamp(
    typeof obj.total === "number" ? Number(obj.total) : sum,
    0,
    100,
  );
  const reconciledTotal = Math.abs(total - sum) > 5 ? sum : total;

  const modelAnswer =
    typeof obj.modelAnswer === "string" && obj.modelAnswer.trim()
      ? obj.modelAnswer.trim()
      : question.modelAnswerOutline;

  return {
    scores: { citation, procedure, coherence },
    total: reconciledTotal,
    deductions: asStringList(obj.deductions, 8),
    strengths: asStringList(obj.strengths, 8),
    modelAnswer,
  };
}

export function buildFallbackGrade(
  question: ScenarioEssayQuestion,
  userAnswer: string,
): Omit<ScenarioEssayGradeResult, "ok" | "questionId" | "model" | "fallback"> {
  const text = userAnswer.trim();
  if (!text) {
    return {
      scores: {
        citation: {
          score: 0,
          max: RUBRIC_WEIGHTS.citation,
          comment: "未作答，無法評定法條引用。",
        },
        procedure: {
          score: 0,
          max: RUBRIC_WEIGHTS.procedure,
          comment: "未作答，無法評定處置程序。",
        },
        coherence: {
          score: 0,
          max: RUBRIC_WEIGHTS.coherence,
          comment: "未作答。",
        },
      },
      total: 0,
      deductions: ["空白作答"],
      strengths: [],
      modelAnswer: question.modelAnswerOutline,
    };
  }

  let citationScore = 8;
  let procedureScore = 12;
  let coherenceScore = 12;
  const deductions: string[] = [];
  const strengths: string[] = [];

  const hitMust = question.rubricFocus.mustCover.filter((k) => {
    const keys = k.split(/[：:]/)[0] ?? k;
    const token = keys.replace(/（.*?）/g, "").slice(0, 12);
    return token.length >= 2 && text.includes(token.slice(0, 6));
  }).length;
  citationScore += Math.min(16, hitMust * 5);
  procedureScore += Math.min(20, hitMust * 4);

  for (const pit of question.rubricFocus.commonPitfalls) {
    const tip = pit.slice(0, 8);
    if (tip && text.includes(tip.slice(0, 4))) {
      deductions.push(`可能踩到常見誤區：${pit}`);
      citationScore = Math.max(4, citationScore - 4);
      procedureScore = Math.max(6, procedureScore - 6);
    }
  }

  if (text.length >= 120) {
    coherenceScore += 8;
    strengths.push("論述有一定篇幅，利於展開程序說明");
  } else {
    deductions.push("論述偏短，程序與依據可再展開");
    coherenceScore = Math.max(6, coherenceScore - 4);
  }
  if (/謹|陳核|簽|依約|按|茲|本部|本機關/.test(text)) {
    coherenceScore += 4;
    strengths.push("用語接近公文語氣");
  }
  if (/第\s*\d+\s*條/.test(text)) {
    citationScore += 4;
    strengths.push("有嘗試引用條次");
  }

  citationScore = clamp(citationScore, 0, RUBRIC_WEIGHTS.citation);
  procedureScore = clamp(procedureScore, 0, RUBRIC_WEIGHTS.procedure);
  coherenceScore = clamp(coherenceScore, 0, RUBRIC_WEIGHTS.coherence);

  if (deductions.length === 0) {
    deductions.push("離線評分僅能粗估；請在 AI 可用時重送以取得完整批改");
  }

  return {
    scores: {
      citation: {
        score: citationScore,
        max: RUBRIC_WEIGHTS.citation,
        comment: "離線粗評：依法條關鍵詞命中度估算。",
      },
      procedure: {
        score: procedureScore,
        max: RUBRIC_WEIGHTS.procedure,
        comment: "離線粗評：依評分焦點覆蓋度估算。",
      },
      coherence: {
        score: coherenceScore,
        max: RUBRIC_WEIGHTS.coherence,
        comment: "離線粗評：依篇幅與用語特徵估算。",
      },
    },
    total: citationScore + procedureScore + coherenceScore,
    deductions,
    strengths,
    modelAnswer: question.modelAnswerOutline,
  };
}

export async function gradeScenarioEssay(params: {
  questionId: string;
  userAnswer: string;
}): Promise<ScenarioEssayGradeResult | ScenarioEssayGradeError> {
  const question = getScenarioEssayQuestion(params.questionId);
  if (!question) {
    return { ok: false, error: "找不到指定的情境申論題" };
  }

  const userAnswer = params.userAnswer.trim();
  if (userAnswer.length < 20) {
    return { ok: false, error: "作答過短，請至少撰寫約 20 字以上的完整論述" };
  }
  if (userAnswer.length > 6000) {
    return { ok: false, error: "作答過長，請精簡至 6000 字以內" };
  }

  const probe = [
    question.prompt,
    question.tags.join(" "),
    question.rubricFocus.mustCover.join("\n"),
    userAnswer.slice(0, 500),
  ].join("\n");

  const { chunks } = await retrieveForRag(probe, 8);
  const context = chunks.length > 0 ? formatRagContext(chunks) : "（無檢索片段）";

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const aiDisabled =
    process.env.OPENAI_DISABLED === "true" || process.env.OPENAI_DISABLED === "1";

  if (!apiKey || aiDisabled) {
    const fb = buildFallbackGrade(question, userAnswer);
    return {
      ok: true,
      questionId: question.id,
      ...fb,
      model: "rubric-fallback",
      fallback: true,
    };
  }

  const client = new OpenAI({ apiKey });
  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SCENARIO_ESSAY_GRADING_SYSTEM },
        {
          role: "user",
          content: [
            "【情境題】",
            question.prompt,
            "",
            "【評分焦點（必須核對）】",
            ...question.rubricFocus.mustCover.map((x) => `- ${x}`),
            "",
            "【常見誤區（扣分參考）】",
            ...question.rubricFocus.commonPitfalls.map((x) => `- ${x}`),
            "",
            "【示範回答大綱（可改寫為完整 modelAnswer）】",
            question.modelAnswerOutline,
            "",
            "【檢索片段】",
            context,
            "",
            "【學員作答】",
            userAnswer,
            "",
            "請依 Rubric 批改，只輸出規定之 JSON。",
          ].join("\n"),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = extractJsonObject(content);
    if (!parsed) {
      const fb = buildFallbackGrade(question, userAnswer);
      return {
        ok: true,
        questionId: question.id,
        ...fb,
        model: "rubric-parse-fallback",
        fallback: true,
      };
    }

    const normalized = normalizeGradePayload(parsed, question);
    return {
      ok: true,
      questionId: question.id,
      ...normalized,
      model: completion.model,
      fallback: false,
    };
  } catch (err) {
    console.error("[scenario-essay-grade] OpenAI error:", err);
    const fb = buildFallbackGrade(question, userAnswer);
    return {
      ok: true,
      questionId: question.id,
      ...fb,
      model: "rubric-fallback",
      fallback: true,
    };
  }
}
