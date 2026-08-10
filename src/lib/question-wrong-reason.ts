/**
 * 題庫單題：AI 錯題原因分析（結合 RAG）。
 */

import OpenAI from "openai";

import { resolveQuestionExplanation } from "@/lib/question-bank-explanations";
import { resolveKnowledgeTags } from "@/lib/knowledge-tags";
import { formatAnswerLabel, parseReferenceAnswer } from "@/lib/mock-exam";
import prisma from "@/lib/prisma";
import { formatRagContext, retrieveForRag } from "@/lib/rag";

export type QuestionWrongReasonResult = {
  ok: true;
  isCorrect: boolean;
  referenceAnswer: string | null;
  analysis: string;
  weakTags: string[];
  model: string;
};

export type QuestionWrongReasonError = {
  ok: false;
  error: string;
};

const SYSTEM = `你是政府採購法規教學助教。學習者在題庫練習答錯一題。
請只輸出「錯題原因分析」與簡短「弱點提示」，格式：

## 錯題原因分析
（3～6 句：為何參考答案正確、學員答案錯在哪、常見陷阱）

## 弱點提示
（1～3 句：對應知識標籤應複習的重點）

規則：僅依檢索片段與題目資料；片段未出現的條號、文號、金額數字不可寫出。`;

function buildFallback(params: {
  userLabel: string;
  refLabel: string;
  tags: string[];
  isCorrect: boolean;
}): string {
  if (params.isCorrect) {
    return `## 錯題原因分析\n您的答案與參考答案一致（${params.refLabel}），本題無需錯題分析。\n\n## 弱點提示\n可繼續練習同知識標籤：${params.tags.join("、") || "相關單元"}。`;
  }
  return [
    "## 錯題原因分析",
    `您選 ${params.userLabel}，參考答案為 ${params.refLabel}。請對照題幹要件與易混淆選項差異，並回題庫完整教學解析複習。`,
    "",
    "## 弱點提示",
    `建議補強知識標籤：${params.tags.join("、") || "招標程序"}。可至模擬考試完成一場後查看整體弱點分析。`,
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
  const type = "MULTIPLE_CHOICE" as const;
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
  const userLabel = formatAnswerLabel(userAnswer, type);
  const refLabel = formatAnswerLabel(referenceAnswer, type);

  if (isCorrect) {
    return {
      ok: true,
      isCorrect: true,
      referenceAnswer,
      analysis: buildFallback({ userLabel, refLabel, tags, isCorrect: true }),
      weakTags: tags,
      model: "none",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const aiDisabled =
    process.env.OPENAI_DISABLED === "true" || process.env.OPENAI_DISABLED === "1";

  const probe = [
    "題庫錯題原因分析",
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
      analysis: buildFallback({ userLabel, refLabel, tags, isCorrect: false }),
      weakTags: tags,
      model: !apiKey || aiDisabled ? "fallback" : "fallback-no-chunks",
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
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
            `學員答案：${userLabel}`,
            `參考答案：${refLabel}`,
            resolved.hasFullExplanation && resolved.hintAnswer
              ? `\n【題庫教學解析摘錄】\n${resolved.hintAnswer.slice(0, 1200)}`
              : "",
            "",
            "請輸出錯題原因分析與弱點提示。",
          ].join("\n"),
        },
      ],
    });
    const analysis =
      completion.choices[0]?.message?.content?.trim() ||
      buildFallback({ userLabel, refLabel, tags, isCorrect: false });
    return {
      ok: true,
      isCorrect: false,
      referenceAnswer,
      analysis,
      weakTags: tags,
      model: completion.model,
    };
  } catch (e) {
    console.error("[question-wrong-reason]", e);
    return {
      ok: true,
      isCorrect: false,
      referenceAnswer,
      analysis: buildFallback({ userLabel, refLabel, tags, isCorrect: false }),
      weakTags: tags,
      model: "fallback",
    };
  }
}
