/**
 * 依主題以 RAG＋（可選）OpenAI 產生單元教材草稿。
 * 產出內容僅供教師審核，不可直接發布。
 */

import OpenAI from "openai";

import { formatRagContext, retrieveForRag } from "@/lib/rag";
import { sanitizeUserText } from "@/lib/defense";

export type GenerateUnitMaterialInput = {
  category: string;
  title: string;
  unitCode?: string | null;
  focus?: string | null;
};

export type GenerateUnitMaterialResult = {
  title: string;
  summary: string;
  content: string;
  model: string;
  warning?: string;
};

function buildOutlineFallback(
  input: GenerateUnitMaterialInput,
  context: string,
): GenerateUnitMaterialResult {
  const focus = input.focus?.trim();
  const excerpt = context
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, 40)
    .join("\n");
  const content = [
    `## 學習目標`,
    `- 理解「${input.title}」於政府採購實務之定位`,
    `- 能對照相關法規／函釋重點作答與教學`,
    focus ? `- 聚焦：${focus}` : null,
    ``,
    `## 主題說明`,
    `本單元主題分類為「${input.category}」。以下內容依知識庫檢索片段整理，**須經教師審核後**始可發布給學員。`,
    ``,
    `## 法規／函釋摘錄（供審核）`,
    excerpt || "（目前知識庫未檢索到足夠片段，請教師自行補充。）",
    ``,
    `## 教學提示`,
    `- 請核對金額門檻、招標／決標程序是否與最新工程會公告一致`,
    `- 補充課堂例題或常見錯誤態樣`,
    `- 進入「待審」後，請教師核准才可發布`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    title: input.title,
    summary: focus
      ? `${input.category}｜${focus}`.slice(0, 200)
      : `${input.category}單元教材草稿（待審核）`.slice(0, 200),
    content,
    model: "rag-outline-fallback",
    warning: "openai-unavailable",
  };
}

export async function generateUnitMaterialDraft(
  input: GenerateUnitMaterialInput,
): Promise<GenerateUnitMaterialResult> {
  const title = sanitizeUserText(input.title, 200).trim();
  const category = input.category.trim();
  const focus = input.focus ? sanitizeUserText(input.focus, 500).trim() : "";
  if (!title) throw new Error("請填寫教材標題");
  if (!category) throw new Error("請選擇主題分類");

  const query = [title, category, focus].filter(Boolean).join("\n");
  const { chunks } = await retrieveForRag(query, 8);
  const context = chunks.length ? formatRagContext(chunks) : "";

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const aiDisabled = process.env.OPENAI_DISABLED === "true" || process.env.OPENAI_DISABLED === "1";
  if (!apiKey || aiDisabled || !context) {
    return buildOutlineFallback({ ...input, title, focus }, context);
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `你是台灣政府採購法教學助教。請依提供的法規／函釋片段，撰寫「單元教材草稿」給教師審核。
要求：
1. 使用繁體中文與 Markdown（## 標題、- 條列）。
2. 結構至少含：學習目標、主題說明、法規重點、常見迷思／易錯點、教學提示。
3. 重要論點標註 [片段N]；勿捏造法條編號或金額。
4. 片段不足處明確寫「檢索片段未足，請教師補充」。
5. 勿輸出與政府採購無關內容；勿要求學員直接背誦未經審核之草稿。
6. 另以一行「SUMMARY: …」開頭寫 40 字內摘要，其後空一行再寫正文。`,
        },
        {
          role: "user",
          content: `主題分類：${category}
教材標題：${title}
${focus ? `教學聚焦：${focus}\n` : ""}
以下為知識庫片段：
${context}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) return buildOutlineFallback({ ...input, title, focus }, context);

    let summary = `${category}單元教材草稿（待審核）`;
    let body = raw;
    const sumMatch = raw.match(/^SUMMARY:\s*(.+)\n+/i);
    if (sumMatch) {
      summary = sumMatch[1]!.trim().slice(0, 200);
      body = raw.slice(sumMatch[0].length).trim();
    }

    return {
      title,
      summary,
      content: body.slice(0, 50000),
      model,
    };
  } catch (e) {
    console.error("[generate-unit-material]", e);
    const fallback = buildOutlineFallback({ ...input, title, focus }, context);
    return {
      ...fallback,
      warning: e instanceof Error ? e.message : "generate-failed",
    };
  }
}
