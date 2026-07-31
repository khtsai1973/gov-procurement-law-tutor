import OpenAI from "openai";

import { analyzeAmountTierQuestion } from "@/lib/amount-tier";
import {
  buildBelowThresholdSupervisionAnswer,
  isBelowThresholdSupervisionQuery,
} from "@/lib/below-threshold-supervision";
import { analyzeOpeningBidderCount } from "@/lib/opening-bidder-count";
import { formatRagContext, type ChunkWithReg } from "@/lib/rag";
import prisma from "@/lib/prisma";
import { OFF_TOPIC_REPLY, isOnTopicQuestion } from "@/lib/topic-scope";

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

function buildDeterministicTierAnswer(
  question: string,
  chunks: ChunkWithReg[],
): string | null {
  const analysis = analyzeAmountTierQuestion(question);
  if (!analysis?.tier || !analysis.category || analysis.amount == null) return null;

  const hasThresholdChunk = chunks.some(
    (c) =>
      c.regulation.slug === "pcc-procurement-amount-thresholds" ||
      /公告金額|查核金額|巨額/.test(c.content),
  );
  if (!hasThresholdChunk) return null;

  const amountLabel =
    analysis.amount >= 10_000 && analysis.amount % 10_000 === 0
      ? `${analysis.amount / 10_000} 萬元`
      : `${analysis.amount.toLocaleString("zh-TW")} 元`;

  return [
    `結論：新臺幣 ${amountLabel} 之「${analysis.category}」採購，屬「${analysis.tier}」。`,
    "",
    "說明：",
    `1. 標的歸類：${analysis.categoryReason ?? `本案按${analysis.category}認定`}；資訊服務、專業服務、技術服務等屬勞務（政府採購法第七條）。`,
    `2. 級距對照：依工程會採購金額門檻彙整，將本案金額與該類別之小額／公告金額／查核金額／巨額門檻比較後，落在「${analysis.tier}」。`,
    "3. 請再對照下方檢索片段中的門檻表數字；實際適用仍以工程會最新公告為準。",
    "",
    "—— 檢索摘錄 ——",
    ...chunks.slice(0, 3).map(
      (c) =>
        `《${c.regulation.title}》\n${c.content.slice(0, 700)}${c.content.length > 700 ? "…" : ""}`,
    ),
  ].join("\n");
}

function buildDeterministicBidderCountAnswer(
  question: string,
  chunks: ChunkWithReg[],
): string | null {
  const analysis = analyzeOpeningBidderCount(question);
  if (!analysis) return null;

  const hasSupport = chunks.some(
    (c) =>
      /三家|公開評選|限制性招標|第四十八|第二十二|合格廠商|專業服務|資訊服務/.test(c.content) ||
      c.regulation.slug === "gpa-enforcement-rules" ||
      c.regulation.slug === "government-procurement-act" ||
      c.regulation.slug === "most-advantageous-tender-operations-manual",
  );
  if (!hasSupport && analysis.mode !== "art22_9_inapplicable") return null;

  // 不相容案：即使沒有完美片段也應輸出更正結論
  if (analysis.mode === "art22_9_inapplicable" || analysis.minQualifiedVendors != null) {
    return [
      `結論：${analysis.conclusion}`,
      "",
      "說明：",
      "1. 第22條第1項第9款僅限委託專業／技術／資訊／社福服務（勞務）經公開客觀評選為優勝者；不適用財物採購，亦不適用工程採購。",
      "2. 採購法第48條「三家以上合格廠商」＋施行細則第55條：該「三家」係指公開招標。",
      "3. 請對照下方檢索片段原文。",
      "",
      "—— 檢索摘錄 ——",
      ...chunks.slice(0, 3).map(
        (c) =>
          `《${c.regulation.title}》\n${c.content.slice(0, 700)}${c.content.length > 700 ? "…" : ""}`,
      ),
    ].join("\n");
  }

  return null;
}

function buildDeterministicAnswer(question: string, chunks: ChunkWithReg[]): string | null {
  if (isBelowThresholdSupervisionQuery(question)) {
    return buildBelowThresholdSupervisionAnswer();
  }
  return (
    buildDeterministicBidderCountAnswer(question, chunks) ??
    buildDeterministicTierAnswer(question, chunks)
  );
}

const RAG_SYSTEM_PROMPT = `你是政府採購法教學助教，採 RAG（檢索增強生成）模式：僅能依據檢索系統取回之全文片段作答（非摘要或杜撰）。

主題範圍（最優先）：
- 本站僅回答與「政府採購法及其子法、工程會函釋／公告、招標／決標／履約／爭議等採購實務」有關之問題。
- 若使用者問題與上述主題無關（例如閒聊、天氣、程式設計、一般法律以外之採購法無關問題、其他考試科目等），請直接且僅回覆：${OFF_TOPIC_REPLY}
- 離題時不要引用片段、不要條列說明、不要補充建議。

檢索與作答流程（與本站說明一致）：
1. 系統已自「法規／函釋清單」及題庫檢索整合分析全文片段（非摘要）以找出解答；請依這些片段作答，先寫 1～2 句結論，再以條列說明，每一重要論點後標註 [片段N]。
2. 若使用者訊息含「（題庫導引：…）」、「【系統級距判定導引…】」或「【系統開標家數判定導引…】」，表示檢索／系統已提供分析方向；正式論點仍須來自 [片段N] 全文，並與導引交叉驗證。
3. 應整合、對照多則全文片段（含不同法規、函釋與題庫導引）；仍須標註 [片段N]，並區分「片段已載明」與「依多則片段綜合推論」。
4. 檢索片段仍不足以涵蓋問題重點時，開頭寫「檢索片段中未足以完整說明」，分別列出「已提及」「未提及」，並建議使用者至本站「法規／函釋清單」查閱全文（非摘要）。
5. 若問題過於笼统、缺少適用法規所需之關鍵事實（例如未說明採購標的、採購金額、程序階段、招標或決標方式），仍先依檢索片段盡可能作答；在條列說明之後另設「建議補充資訊」小節，列出 2～4 項使用者若能補充可使答案更精準之事實類型（例如標的類型、金額是否含稅、是否屬限制性招標、是否已組評選委員會），勿捏造條文。若片段已足夠完整作答，可省略此小節。

金額級距／門檻歸類（重要，應主動整合分析）：
- 當使用者給出採購金額，並詢問屬哪一級距（或是否達公告／查核／巨額），且片段中已有工程會門檻表或等同數字時：
  (a) 先依片段認定標的類別：資訊服務／專業服務／技術服務等屬「勞務」（採購法對工程、財物、勞務之定義）；工程、財物各用其門檻。
  (b) 將使用者金額與該類別「小額／公告金額／查核金額／巨額」門檻比較（得做大小比較與級距歸屬，這屬於依片段綜合推論，不是捏造）。
  (c) 結論須寫明：採購類別＋級距（例如「達公告金額、未達查核金額之勞務採購」），並列出據以比較的門檻數字與 [片段N]。
- 範例邏輯：250 萬元資訊服務 → 勞務；勞務公告金額 150 萬、查核金額 1,000 萬 → 屬達公告金額、未達查核金額之勞務採購。
- 不得捏造片段未出現的門檻數字；若片段已載明，必須引用並完成歸類，勿僅重述數字而不下結論。

開標合格廠商家數（重要，勿與公開招標混淆）：
- 採購法第48條「三家以上合格廠商」＋施行細則第55條：該「三家」係指**公開招標**。
- 依第22條第1項第9款「公開評選」之限制性招標：**僅適用**委託專業服務、技術服務、資訊服務或社會福利服務（屬**勞務**）。第一次開標無須 3 家，有 1 家合格廠商即得開標／續行評選。
- **第22條第1項第9款不適用財物採購，亦不適用工程採購。** 若本案已認定為財物（或工程），即使問題出現「公開評選／限制性招標」字樣，也**不得**引用第9款主張「第一次開標只需1家」。應先指出適用範圍不符，再依實際招標方式（例如公開招標→第一次3家；或其他第22條款次之限制性招標程序）說明。
- 範例（正確）：250 萬元資訊服務＋第22條第1項第9款公開評選限制性招標 → 至少 1 家。
- 範例（須更正）：4800 萬元財物採購卻套用第9款「1家即可」→ 錯誤；應說明第9款不適用財物。
- 若問題實為公開招標第一次開標，則結論為 3 家以上；第一次流標後第二次得不受三家限制。

嚴格限制：
- 不得捏造條號、函釋文號、金額級距數字或主管機關見解；片段未出現的條號、數字、文號一律不可寫出。
- 使用者問題中的預算或金額，除級距歸類所需之比較外，不可自行加總後斷言級距；後續擴充、選購是否併計須片段有依據。提醒以工程會最新公告為準。
- 級距結論與招標程序結論必須一致：財物級距案不可搭配第22條第1項第9款開標家數規則。

使用繁體中文，語氣專業、清楚。`;

export async function generateGroundedAnswer(
  question: string,
  chunks: ChunkWithReg[],
  options?: { questionBankHint?: string },
): Promise<AnswerResult> {
  if (!isOnTopicQuestion(question)) {
    return { answer: OFF_TOPIC_REPLY, model: "off-topic" };
  }

  if (chunks.length === 0) {
    // 未達公告金額監辦時機有明確條文結論，即使檢索空也先給確定性回答
    if (isBelowThresholdSupervisionQuery(question)) {
      return {
        answer: buildBelowThresholdSupervisionAnswer(),
        model: "below-threshold-supervision-rules",
      };
    }

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
  const tierGuidance = analyzeAmountTierQuestion(question)?.guidance;
  const bidderGuidance = analyzeOpeningBidderCount(question)?.guidance;
  const systemGuidance = [tierGuidance, bidderGuidance].filter(Boolean).join("\n\n");

  // 監辦時機：優先使用確定性回答，避免與「公告金額以上會同監辦」混淆
  const deterministicPreferred = buildDeterministicAnswer(question, chunks);
  if (deterministicPreferred && isBelowThresholdSupervisionQuery(question)) {
    return {
      answer: deterministicPreferred,
      model: "below-threshold-supervision-rules",
      warning: !apiKey ? "openai-unavailable" : undefined,
    };
  }

  if (!apiKey || aiDisabled) {
    const deterministic = deterministicPreferred ?? buildDeterministicAnswer(question, chunks);
    if (deterministic) {
      const bidder = analyzeOpeningBidderCount(question);
      return {
        answer: deterministic,
        model:
          bidder?.mode === "art22_9_inapplicable"
            ? "art22-scope-guard"
            : bidder?.minQualifiedVendors != null
              ? "opening-bidder-rules"
              : "amount-tier-rules",
        warning: !apiKey ? "openai-unavailable" : undefined,
      };
    }
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
  const guideNote = systemGuidance ? `\n\n${systemGuidance}` : "";

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: RAG_SYSTEM_PROMPT },
        {
          role: "user",
          content: `以下為檢索系統自法規／函釋清單依問題挑選的全文片段（非摘要）：\n\n${context}\n\n---\n\n使用者問題：\n${question}${bankNote}${guideNote}\n\n請整合上列片段作答；若為金額級距或開標家數問題，須給出明確結論。特別注意：第22條第1項第9款不適用財物／工程，不可與財物級距結論錯誤搭配「依第9款第一次開標1家」。\n（若此問題與政府採購法規教學無關，請只回覆：${OFF_TOPIC_REPLY}）`,
        },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? "無法產生回答。";
    return { answer, model: completion.model };
  } catch (err) {
    console.error("[answer] OpenAI error:", err);

    const deterministic = buildDeterministicAnswer(question, chunks);
    if (deterministic) {
      return {
        answer: deterministic,
        model: "rules-fallback",
        warning: "openai-unavailable",
      };
    }

    if (isOpenAIQuotaError(err)) {
      return excerptFallback(
        chunks,
        "OpenAI 額度不足，以下為 RAG 檢索摘錄（非 AI 整理解答）：\n\n",
      );
    }

    return excerptFallback(chunks, "AI 服務暫時無法連線，以下為 RAG 檢索摘錄：\n\n");
  }
}
