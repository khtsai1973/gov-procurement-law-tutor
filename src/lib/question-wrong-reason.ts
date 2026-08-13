/**
 * 階段 1：錯題 AI 動態診斷（LLM-Powered Error Analysis）
 *
 * 當使用者選錯選擇題時，除固定解析外，請 LLM 分析：
 * - 選擇錯誤選項的常見認知誤區
 * - 正確／錯誤選項在採購法適用條件上的核心差異（2 句）
 */

import OpenAI from "openai";

import { resolveQuestionExplanation } from "@/lib/question-bank-explanations";
import { resolveKnowledgeTags } from "@/lib/knowledge-tags";
import {
  formatAnswerLabel,
  getMockExamOptions,
  inferMockExamQuestionType,
  parseReferenceAnswer,
  type MockExamOption,
} from "@/lib/mock-exam";
import prisma from "@/lib/prisma";
import { formatRagContext, retrieveForRag } from "@/lib/rag";

export type QuestionWrongReasonResult = {
  ok: true;
  isCorrect: boolean;
  referenceAnswer: string | null;
  analysis: string;
  /** 精簡版：認知誤區＋2 句適用差異（方便 UI） */
  cognitiveBrief: string | null;
  weakTags: string[];
  model: string;
};

export type QuestionWrongReasonError = {
  ok: false;
  error: string;
};

export const WRONG_CHOICE_DIAGNOSIS_SYSTEM = `你是政府採購法規教學助教。學習者在選擇題答錯。

任務（務必執行）：
1. 分析學習者選擇錯誤選項的「常見認知誤區」（為何容易選錯）。
2. 用恰好 2 句話說明「正確選項」與「錯誤選項」在採購法適用條件上的核心差異。
3. 給 1～2 句弱點複習提示。

僅依題目、選項文字與檢索片段作答；片段未出現的條號、文號、金額數字不可寫出。
語氣清楚、適合作錯題檢討。

必須使用下列 Markdown 標題（不可改名）：

## 認知誤區
（2～4 句）

## 適用條件差異
（恰好 2 句；分別對照正確選項與錯誤選項的適用條件）

## 弱點提示
（1～2 句）`;

/** 組出與產品規格一致的使用者 Prompt 核心句 */
export function buildWrongChoiceUserDirective(params: {
  userChoiceLabel: string;
  correctChoiceLabel: string;
  userOptionText?: string | null;
  correctOptionText?: string | null;
}): string {
  const wrong = params.userChoiceLabel;
  const right = params.correctChoiceLabel;
  const wrongBody = params.userOptionText?.trim()
    ? `${wrong}「${params.userOptionText.trim()}」`
    : wrong;
  const rightBody = params.correctOptionText?.trim()
    ? `${right}「${params.correctOptionText.trim()}」`
    : right;
  return [
    `使用者選擇了 ${wrongBody}，但標準答案為 ${rightBody}。`,
    `請分析選擇 ${wrong} 的常見認知誤區，並用 2 句話說明 ${right} 與 ${wrong} 在採購法適用條件上的核心差異。`,
  ].join("");
}

export function extractCognitiveBrief(analysis: string): string | null {
  const mis = analysis.match(/##\s*認知誤區\s*\n([\s\S]*?)(?=\n##\s*|$)/);
  const diff = analysis.match(/##\s*適用條件差異\s*\n([\s\S]*?)(?=\n##\s*|$)/);
  if (!mis && !diff) return null;
  const parts: string[] = [];
  if (mis?.[1]?.trim()) parts.push(`【認知誤區】\n${mis[1].trim()}`);
  if (diff?.[1]?.trim()) parts.push(`【適用條件差異】\n${diff[1].trim()}`);
  return parts.join("\n\n") || null;
}

function choiceDisplay(value: string, type: string): string {
  if (type === "TRUE_FALSE") return formatAnswerLabel(value, type);
  if (/^[1-4]$/.test(value)) return `選項 (${value})`;
  return formatAnswerLabel(value, type);
}

function optionText(options: MockExamOption[], value: string): string | null {
  return options.find((o) => o.value === value)?.label?.trim() || null;
}

function buildFallback(params: {
  userLabel: string;
  refLabel: string;
  userOptionText: string | null;
  correctOptionText: string | null;
  tags: string[];
  isCorrect: boolean;
}): string {
  if (params.isCorrect) {
    return [
      "## 認知誤區",
      `您的答案與參考答案一致（${params.refLabel}），本題無需錯題分析。`,
      "",
      "## 適用條件差異",
      "本題已答對，無選項差異可對照。",
      "可繼續練習同知識標籤以鞏固觀念。",
      "",
      "## 弱點提示",
      `可繼續練習：${params.tags.join("、") || "相關單元"}。`,
    ].join("\n");
  }
  const wrongBody = params.userOptionText
    ? `${params.userLabel}「${params.userOptionText}」`
    : params.userLabel;
  const rightBody = params.correctOptionText
    ? `${params.refLabel}「${params.correctOptionText}」`
    : params.refLabel;
  return [
    "## 認知誤區",
    `選擇 ${wrongBody} 常見是把相似程序或要件混用，未先核對題幹的招標方式、金額級距或標的類型。`,
    "",
    "## 適用條件差異",
    `${rightBody} 對應題幹要件下的正確適用條件；請依題幹事實對照法規構成要件。`,
    `${wrongBody} 通常適用於其他情境，套用到本題會漏掉關鍵限制或例外。`,
    "",
    "## 弱點提示",
    `建議補強：${params.tags.join("、") || "招標程序"}；並回顧題庫完整解析。`,
  ].join("\n");
}

export async function diagnoseQuestionWrongReason(params: {
  itemKey: string;
  userAnswer: string;
}): Promise<QuestionWrongReasonResult | QuestionWrongReasonError> {
  const item = await prisma.questionBankItem.findUnique({
    where: { key: params.itemKey },
  });
  if (!item) return { ok: false, error: "找不到題目" };

  const resolved = resolveQuestionExplanation({
    key: item.key,
    hintAnswer: item.hintAnswer,
    importance: item.importance,
  });
  const type = inferMockExamQuestionType(item) ?? "MULTIPLE_CHOICE";
  const referenceAnswer = parseReferenceAnswer(resolved.hintAnswer, type);
  const userAnswer = params.userAnswer.trim();
  if (!userAnswer) return { ok: false, error: "請先選擇答案" };
  if (!referenceAnswer) {
    return { ok: false, error: "本題尚無參考答案，無法自動分析" };
  }

  const isCorrect = userAnswer.toUpperCase() === referenceAnswer.toUpperCase();
  const tags = resolveKnowledgeTags({
    category: item.category,
    keywords: item.keywords,
    knowledgeTags: item.knowledgeTags,
    question: item.question,
  });
  const options = getMockExamOptions(item, type);
  const userLabel = choiceDisplay(userAnswer, type);
  const refLabel = choiceDisplay(referenceAnswer, type);
  const userOptionText = optionText(options, userAnswer);
  const correctOptionText = optionText(options, referenceAnswer);

  const fallback = buildFallback({
    userLabel,
    refLabel,
    userOptionText,
    correctOptionText,
    tags,
    isCorrect,
  });

  if (isCorrect) {
    return {
      ok: true,
      isCorrect: true,
      referenceAnswer,
      analysis: fallback,
      cognitiveBrief: extractCognitiveBrief(fallback),
      weakTags: tags,
      model: "none",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const aiDisabled =
    process.env.OPENAI_DISABLED === "true" || process.env.OPENAI_DISABLED === "1";

  const probe = [
    "題庫錯題認知誤區分析",
    `標籤：${tags.join("、")}`,
    item.question.slice(0, 280),
    `學員答案：${userLabel}`,
    `參考答案：${refLabel}`,
  ].join("\n");
  const { chunks } = await retrieveForRag(probe, 6);

  if (!apiKey || aiDisabled || chunks.length === 0) {
    return {
      ok: true,
      isCorrect: false,
      referenceAnswer,
      analysis: fallback,
      cognitiveBrief: extractCognitiveBrief(fallback),
      weakTags: tags,
      model: !apiKey || aiDisabled ? "fallback" : "fallback-no-chunks",
    };
  }

  const directive = buildWrongChoiceUserDirective({
    userChoiceLabel: userLabel,
    correctChoiceLabel: refLabel,
    userOptionText,
    correctOptionText,
  });

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: WRONG_CHOICE_DIAGNOSIS_SYSTEM },
        {
          role: "user",
          content: [
            "【檢索片段】",
            formatRagContext(chunks),
            "",
            "【題目】",
            item.question,
            `類別：${item.category}`,
            `知識標籤：${tags.join("、") || "—"}`,
            `學員答案：${userLabel}${userOptionText ? ` ${userOptionText}` : ""}`,
            `參考答案：${refLabel}${correctOptionText ? ` ${correctOptionText}` : ""}`,
            resolved.hasFullExplanation && resolved.hintAnswer
              ? `\n【題庫固定解析摘錄】\n${resolved.hintAnswer.slice(0, 1000)}`
              : "",
            "",
            directive,
            "",
            "請依規定標題輸出診斷。",
          ].join("\n"),
        },
      ],
    });
    const analysis =
      completion.choices[0]?.message?.content?.trim() || fallback;
    return {
      ok: true,
      isCorrect: false,
      referenceAnswer,
      analysis,
      cognitiveBrief: extractCognitiveBrief(analysis),
      weakTags: tags,
      model: completion.model,
    };
  } catch (e) {
    console.error("[question-wrong-reason]", e);
    return {
      ok: true,
      isCorrect: false,
      referenceAnswer,
      analysis: fallback,
      cognitiveBrief: extractCognitiveBrief(fallback),
      weakTags: tags,
      model: "fallback",
    };
  }
}
