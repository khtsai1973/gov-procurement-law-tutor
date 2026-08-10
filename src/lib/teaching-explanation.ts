/**
 * 題庫「完整教學解析」七段結構：
 * 正確答案｜法規名稱與條號｜正確理由｜錯誤選項分析｜常見陷阱｜官方來源｜相似題目
 */

import { FULL_EXPLANATION_MARKER } from "@/lib/question-bank-types";

export const TEACHING_EXPLANATION_SECTIONS = [
  "正確答案",
  "法規名稱與條號",
  "正確理由",
  "錯誤選項分析",
  "常見陷阱",
  "官方來源",
  "相似題目",
] as const;

export type TeachingExplanationSection = (typeof TEACHING_EXPLANATION_SECTIONS)[number];

export type TeachingExplanation = Record<TeachingExplanationSection, string>;

export type TeachingExplanationOption = {
  index: string; // "1" | "2" | "3" | "4"
  text: string;
};

const SECTION_HEADER_RE =
  /^【(正確答案|法規名稱與條號|正確理由|錯誤選項分析|常見陷阱|官方來源|相似題目)】\s*$/;

export function isTeachingExplanationComplete(
  value: TeachingExplanation | null | undefined,
): boolean {
  if (!value) return false;
  return TEACHING_EXPLANATION_SECTIONS.every((k) => value[k]?.trim().length > 0);
}

/** 是否為七段式完整教學解析（含標記與七個標題） */
export function hasTeachingExplanation(hintAnswer: string | null | undefined): boolean {
  if (!hintAnswer?.includes(FULL_EXPLANATION_MARKER)) return false;
  return TEACHING_EXPLANATION_SECTIONS.every((s) => hintAnswer.includes(`【${s}】`));
}

export function formatTeachingExplanation(
  parts: TeachingExplanation,
  opts?: { referenceAnswerLine?: string | null },
): string {
  const blocks: string[] = [];
  const ref = opts?.referenceAnswerLine?.trim();
  if (ref) blocks.push(ref);
  blocks.push(FULL_EXPLANATION_MARKER);
  for (const key of TEACHING_EXPLANATION_SECTIONS) {
    blocks.push(`【${key}】`);
    blocks.push(parts[key].trim());
    blocks.push("");
  }
  blocks.push("正式作答須以檢索到的法規／函釋全文為準，勿僅依題庫背誦。");
  return blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function parseTeachingExplanation(
  hintAnswer: string | null | undefined,
): TeachingExplanation | null {
  if (!hintAnswer?.includes(FULL_EXPLANATION_MARKER)) return null;
  const lines = hintAnswer.replace(/\r\n/g, "\n").split("\n");
  const result = Object.fromEntries(
    TEACHING_EXPLANATION_SECTIONS.map((k) => [k, ""]),
  ) as TeachingExplanation;

  let current: TeachingExplanationSection | null = null;
  const buf: string[] = [];

  const flush = () => {
    if (!current) return;
    result[current] = buf.join("\n").trim();
    buf.length = 0;
  };

  for (const line of lines) {
    const m = line.trim().match(SECTION_HEADER_RE);
    if (m) {
      flush();
      current = m[1] as TeachingExplanationSection;
      continue;
    }
    if (current) buf.push(line);
  }
  flush();

  return isTeachingExplanationComplete(result) ? result : null;
}

/** 從題幹擷取 (1)(2)(3)(4) 選項文字 */
export function parseMcOptions(question: string): TeachingExplanationOption[] {
  const text = question.replace(/\r\n/g, "\n").trim();
  const re = /\(\s*([1-4])\s*\)\s*/g;
  const hits: { index: string; start: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    hits.push({ index: m[1]!, start: m.index, bodyStart: m.index + m[0].length });
  }
  if (hits.length < 2) return [];

  const options: TeachingExplanationOption[] = [];
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const end = i + 1 < hits.length ? hits[i + 1]!.start : text.length;
    let body = text.slice(hit.bodyStart, end).trim();
    body = body.replace(/[。．.\s]+$/u, "").trim();
    if (body) options.push({ index: hit.index, text: body });
  }
  return options;
}

/** 從題幹／關鍵詞擷取「第N條」等條號提示 */
export function extractArticleRefs(question: string, keywords: string[] = []): string[] {
  const blob = [question, ...keywords].join("\n");
  const found = new Set<string>();
  for (const m of blob.matchAll(/第\s*(\d{1,3})\s*條(?:\s*第\s*(\d+)\s*項)?(?:\s*第\s*(\d+)\s*款)?/g)) {
    let label = `第${m[1]}條`;
    if (m[2]) label += `第${m[2]}項`;
    if (m[3]) label += `第${m[3]}款`;
    found.add(label);
  }
  return [...found];
}

export const REGULATION_SLUG_TITLES: Record<string, string> = {
  "government-procurement-act": "政府採購法",
  "gpa-enforcement-rules": "政府採購法施行細則",
  "pcc-procurement-amount-thresholds": "工程會採購金額門檻（函釋／公告彙整）",
  "bidding-deadline-standards": "招標期限標準",
  "vendor-qualification-standards": "投標廠商資格與特殊或巨額採購認定標準",
  "most-advantageous-tender-selection-rules": "最有利標評選辦法",
  "procurement-contract-essentials": "採購契約要項",
  "bid-bond-guarantee-operations-rules": "押標金保證金暨其他擔保作業辦法",
  "technical-service-selection-billing-rules": "機關委託技術服務廠商評選及計費辦法",
  "below-threshold-bidding-rules": "中央機關未達公告金額採購招標辦法",
  "below-threshold-supervision-rules": "中央機關未達公告金額採購監辦辦法",
  "procurement-appeal-rules": "採購申訴審議規則",
  "procurement-mediation-guidelines": "採購履約調解準則",
};

export function regulationTitlesFromSlugs(slugs: string[]): string[] {
  const titles: string[] = [];
  for (const slug of slugs) {
    const title = REGULATION_SLUG_TITLES[slug] ?? slug;
    if (!titles.includes(title)) titles.push(title);
  }
  return titles;
}

export type BuildTeachingExplanationInput = {
  question: string;
  category: string;
  keywords?: string[];
  relatedSlugs?: string[];
  /** 正確選項編號，如 "3" */
  correctOption: string;
  /** 同分類相似題（題幹摘要） */
  similarQuestions?: Array<{ key: string; question: string }>;
};

function stemWithoutOptions(question: string): string {
  const idx = question.search(/\(\s*1\s*\)/);
  if (idx > 0) return question.slice(0, idx).trim();
  return question.trim();
}

function isNegatedStem(stem: string): boolean {
  return /下列何[者項].*(不|非|錯誤|不得|無法)|何者不是|何者錯誤|不得|不正確|非屬|不應/.test(
    stem,
  );
}

function wrongOptionReason(
  stem: string,
  option: TeachingExplanationOption,
  correct: string,
): string {
  const negated = isNegatedStem(stem);
  if (negated) {
    return `選項 (${option.index})「${option.text}」不符合題意所問之「排除／非屬」條件，故非正確答案；正確答案為選項 (${correct})。`;
  }
  return `選項 (${option.index})「${option.text}」與題幹所考之要件／權責／程序不合，易與正確規定混淆，故不採；正確答案為選項 (${correct})。`;
}

function categoryTrap(category: string): string {
  const traps: Record<string, string> = {
    政府採購全生命週期概論:
      "勿把計畫審議階段（可行性／基本設計／細部設計）的審議重點互相套用；亦勿將政策宣示措施誤認為採購法強制規定。",
    "政府採購法之總則、招標及決標":
      "易混淆公開招標「三家」與限制性招標／第22條特殊情形之廠商家數；金額門檻（公告／查核／巨額）須依工程／財物／勞務區分並以工程會最新公告為準。",
    政府採購法之履約管理及驗收:
      "易混淆終止／解除契約之核准層級、轉包與分包、以及保證金不予發還之範圍（全部或部分）。",
    政府採購法之罰則及附則:
      "易混淆停權（刊登公報）事由、刑責構成要件與行政罰；注意「故意／重大過失」等主觀要件。",
    政府採購法之爭議處理:
      "易混淆異議→申訴→調解／仲裁之程序順序與管轄；期限起算時點常是失分關鍵。",
    底價及價格分析:
      "易混淆底價訂定時機、保密義務與價格分析適用時機；勿把底價與預算／預估金額混為一談。",
    投標須知及招標文件製作:
      "易忽略招標文件應載事項、等標期／截止投標、以及資格條件不得不當限制競爭。",
    採購契約:
      "易混淆契約變更、物價指數調整、遲延違約金與保固責任之約定界限。",
    最有利標及評選優勝廠商:
      "易混淆價格標與最有利標、評選委員會組成與評分項目權重；勿把「最低標」思考套到最有利標。",
    電子採購實務:
      "易忽略電子領標／投標／決標之系統作業時點與紙本程序差異；傳輸失敗之處理規定常被忽略。",
    工程及技術服務採購作業:
      "易混淆技術服務計費方式、評選程序與建造費用是否計入特定費用項目。",
    財物及勞務採購作業:
      "易把財物／勞務門檻或招標方式與工程案規則混用；共同供應契約與電子採購實務也常交錯出題。",
    錯誤採購態樣:
      "易把「程序瑕疵」與「違法停權／刑責」態樣混為一談；應先定性行為再對應法效果。",
    道德規範及違法處置:
      "易忽略採購人員倫理與公職人員利益衝突迴避法之競合；「得為／不得為」行為清單常被反向記憶。",
  };
  return (
    traps[category] ??
    "先讀懂題幹是「選正確」還是「選不正確／非屬」；再核對權責層級、金額門檻與程序順序，避免套錯條文。"
  );
}

/** 依題幹／答案組出七段式完整教學解析（學習導引，非法條原文） */
export function buildTeachingExplanation(
  input: BuildTeachingExplanationInput,
): TeachingExplanation {
  const options = parseMcOptions(input.question);
  const stem = stemWithoutOptions(input.question);
  const correct = input.correctOption.trim();
  const correctOpt = options.find((o) => o.index === correct);
  const articles = extractArticleRefs(input.question, input.keywords ?? []);
  const titles = regulationTitlesFromSlugs(input.relatedSlugs ?? []);
  if (titles.length === 0) titles.push("政府採購法", "政府採購法施行細則");

  const lawLine = [
    titles.map((t) => `《${t}》`).join("、"),
    articles.length > 0 ? `相關條號提示：${articles.join("、")}` : "請對照題幹所涉條文與知識庫全文",
  ].join("。");

  const correctReason = (() => {
    const negated = isNegatedStem(stem);
    if (correctOpt) {
      if (negated) {
        return `本題正確答案為選項 (${correct})「${correctOpt.text}」。題幹要求選出「不正確／非屬／不得」之情形，該選項正是不符規定或不得採行之作法，故為正解。其餘選項多屬得採行或符合規定之作法。作答時仍應回知識庫核對《${titles[0]}》及相關函釋全文。`;
      }
      return `本題正確答案為選項 (${correct})「${correctOpt.text}」。依題幹「${stem.slice(0, 80)}${stem.length > 80 ? "…" : ""}」所問，該選項符合《${titles[0]}》及相關規定之要件／程序／權責；作答時仍應回知識庫核對現行條文與函釋全文。`;
    }
    return `本題正確答案為選項 (${correct})。請依題幹要件對照《${titles[0]}》及相關規定，並以知識庫法規／函釋全文為準。`;
  })();

  const wrong = options.filter((o) => o.index !== correct);
  const wrongAnalysis =
    wrong.length > 0
      ? wrong.map((o) => wrongOptionReason(stem, o, correct)).join("\n")
      : `請逐一排除非正確選項，並對照題幹關鍵條件與選項 (${correct}) 之差異。`;

  const similar =
    (input.similarQuestions ?? [])
      .filter((q) => q.question.trim())
      .slice(0, 3)
      .map((q, i) => {
        const s = stemWithoutOptions(q.question).slice(0, 60);
        return `${i + 1}. ${s}${s.length >= 60 ? "…" : ""}（${q.key}）`;
      })
      .join("\n") || "同分類其他高頻題（請於題庫「只看重要／高頻」篩選練習）。";

  const official = [
    ...titles.map((t) => `《${t}》`),
    "公共工程委員會（工程會）公告／函釋（金額門檻等以最新公告為準）",
    `本站法規／函釋清單：${(input.relatedSlugs ?? ["government-procurement-act"]).join("、")}`,
  ].join("\n");

  return {
    正確答案: correctOpt
      ? `選項 (${correct}) ${correctOpt.text}`
      : `選項 (${correct})`,
    法規名稱與條號: lawLine,
    正確理由: correctReason,
    錯誤選項分析: wrongAnalysis,
    常見陷阱: categoryTrap(input.category),
    官方來源: official,
    相似題目: similar,
  };
}

export function teachingExplanationToHintAnswer(
  input: BuildTeachingExplanationInput,
): string {
  const parts = buildTeachingExplanation(input);
  return formatTeachingExplanation(parts, {
    referenceAnswerLine: `【題庫】本題參考答案為 選項 (${input.correctOption.trim()})。`,
  });
}
