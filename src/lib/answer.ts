import OpenAI from "openai";

import type { DocChunk, Regulation } from "@prisma/client";



import { formatRagContext, type ChunkWithReg } from "@/lib/rag";

import prisma from "@/lib/prisma";



export type AnswerResult = {

  answer: string;

  model: string;

  warning?: string;

};



function excerptFallback(chunks: ChunkWithReg[], preamble: string): AnswerResult {

  const excerpt = chunks

    .slice(0, 4)

    .map(

      (c) =>

        `《${c.regulation.title}》\n${c.content.slice(0, 600)}${c.content.length > 600 ? "…" : ""}`,

    )

    .join("\n\n");



  return {

    answer: `${preamble}${excerpt}`,

    model: "keyword-fallback",

    warning: preamble.includes("OpenAI") ? "openai-unavailable" : undefined,

  };

}



function isOpenAIQuotaError(err: unknown): boolean {

  if (!err || typeof err !== "object") return false;

  const e = err as { status?: number; code?: string; error?: { code?: string } };

  if (e.status === 429) return true;

  if (e.code === "insufficient_quota") return true;

  if (e.error?.code === "insufficient_quota") return true;

  return false;

}



const RAG_SYSTEM_PROMPT = `你是政府採購法教學助教，採 RAG（檢索增強生成）模式：僅能依據檢索系統取回之全文片段作答（非摘要或杜撰）。

檢索與作答流程（與本站說明一致）：
1. 系統已自「法規／函釋清單」及題庫檢索整合分析全文片段（非摘要）以找出解答；請依這些片段作答，先寫 1～2 句結論，再以條列說明，每一重要論點後標註 [片段N]。
2. 若使用者訊息含「（題庫導引：…）」，表示檢索時已參考題庫；題庫僅供關鍵詞／出題方向參考，**不得**把題庫答案當法規條文引用，正式論點仍須來自 [片段N] 全文。
3. 應整合、對照多則全文片段（含不同法規、函釋與題庫導引）；仍須標註 [片段N]，並區分「片段已載明」與「依多則片段綜合推論」。
4. 檢索片段仍不足以涵蓋問題重點時，開頭寫「檢索片段中未足以完整說明」，分別列出「已提及」「未提及」，並建議使用者至本站「法規／函釋清單」查閱全文（非摘要）。
5. 若問題過於笼统、缺少適用法規所需之關鍵事實（例如未說明採購標的、採購金額、程序階段、招標或決標方式），仍先依檢索片段盡可能作答；在條列說明之後另設「建議補充資訊」小節，列出 2～4 項使用者若能補充可使答案更精準之事實類型（例如標的類型、金額是否含稅、是否屬限制性招標、是否已組評選委員會），勿捏造條文。若片段已足夠完整作答，可省略此小節。

嚴格限制：
- 不得捏造條號、函釋文號、金額級距數字或主管機關見解；片段未出現的條號、數字、文號一律不可寫出。
- 使用者問題中的預算或金額數字，若片段未要求如何計入或如何分級，只可重述問題中的數字並說明「級距判定須依主管機關公告之公告金額、查核金額等標準」，不可自行加總後斷言屬哪一級距，除非片段有明確門檻。若片段（含工程會金額門檻彙整、主管機關公告整理）已載明查核金額、公告金額、巨額或小額採購之新臺幣數額，應依片段逐類引述，並標註 [片段N]。

使用繁體中文，語氣專業、清楚。`;



export async function generateGroundedAnswer(

  question: string,

  chunks: ChunkWithReg[],

  options?: { questionBankHint?: string },

): Promise<AnswerResult> {

  if (chunks.length === 0) {

    const [regCount, chunkCount] = await Promise.all([

      prisma.regulation.count(),

      prisma.docChunk.count(),

    ]);



    let answer: string;

    if (regCount === 0) {

      answer =

        "法規清單尚未建立。請在專案目錄執行：npm run db:init（或 npm run db:push 後 npm run db:seed），再重新提問。";

    } else if (chunkCount === 0) {

      answer =

        "知識庫尚未載入。請在專案目錄執行：npm run corpus:ingest，或登入管理者後按「載入／更新知識庫」。";

    } else {

      answer =

        "找不到與您問題相關的全文匹配（非摘要）。系統已嘗試法規／函釋清單與題庫輔助檢索。請至「法規／函釋清單」查閱全文，或改以較具體的法規／函釋用語重新提問。";

    }



    return { answer, model: "no-chunks" };

  }



  const apiKey = process.env.OPENAI_API_KEY?.trim();

  const aiDisabled = process.env.OPENAI_DISABLED === "true" || process.env.OPENAI_DISABLED === "1";



  if (!apiKey || aiDisabled) {

    return excerptFallback(

      chunks,

      !apiKey

        ? "尚未設定 OPENAI_API_KEY，以下為 RAG 檢索摘錄，供您自行對照：\n\n"

        : "已停用 OpenAI 生成回答，以下為 RAG 檢索摘錄：\n\n",

    );

  }



  const client = new OpenAI({ apiKey });

  const context = formatRagContext(chunks);

  const bankNote = options?.questionBankHint
    ? `\n\n（題庫導引：${options.questionBankHint}）`
    : "";



  try {

    const completion = await client.chat.completions.create({

      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",

      temperature: 0.15,

      messages: [

        { role: "system", content: RAG_SYSTEM_PROMPT },

        {

          role: "user",

          content: `以下為檢索系統自法規／函釋清單依問題挑選的全文片段（非摘要）：\n\n${context}\n\n---\n\n使用者問題：\n${question}${bankNote}`,

        },

      ],

    });



    const answer = completion.choices[0]?.message?.content?.trim() ?? "無法產生回答。";

    return { answer, model: completion.model };

  } catch (err) {

    console.error("[answer] OpenAI error:", err);



    if (isOpenAIQuotaError(err)) {

      return excerptFallback(

        chunks,

        "OpenAI 額度不足，以下為 RAG 檢索摘錄（非 AI 整理解答）：\n\n",

      );

    }



    return excerptFallback(chunks, "AI 服務暫時無法連線，以下為 RAG 檢索摘錄：\n\n");

  }

}

