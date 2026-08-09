/**
 * Parse plain text from 政府採購法規全部題庫.pdf
 * (工程會題庫格式：編號 + 答案欄 + 試題，選擇題答案為 1–4，是非題為 O/X)
 */
import type { QuestionBankEntry } from "../../src/lib/question-bank-types";

/** 僅略過整行即為表頭／頁碼者；不可用 ^案 等前綴，以免吃掉「標\\n案。」續行 */
const SKIP_LINE =
  /^(?:資料產生日期.*|--\s*\d+\s+of\s+\d+\s*--|第\s*\d+\s*$|條\s*$|編|號|答|案|試|題)$/;

/** 選擇題：編號 答案(1-4) 題幹（pdf-parse 常省略答案與題幹間空白；題幹可換行） */
const MC_LINE_RE = /^(\d{1,4})\s+([1-4])(?:\s+|(?=[\u4e00-\u9fff（(]))(.*)$/;

/** 是非題：編號 O/X 題幹 */
const TF_LINE_RE = /^(\d{1,4})\s+([OXox])(?:\s+|(?=[\u4e00-\u9fff（(]))(.*)$/;

/** 區塊掃描（整段文字備援，處理 pdf-parse 行首空白或合併行） */
const MC_BLOCK_RE =
  /(?:^|\n)\s*(\d{1,4})\s+([1-4])(?:\s+|(?=[\u4e00-\u9fff（(]))([\s\S]*?)(?=(?:\n\s*\d{1,4}\s+[1-4OXox](?:\s+|(?=[\u4e00-\u9fff（(])))|\n(?:選擇題|是非題|複選題|問答題)\s*(?:\n|$)|$)/g;

/** 編號+答案連寫區塊（13下列…、101關於…） */
const MC_CONCAT_BLOCK_RE =
  /(?:^|\n)\s*(\d{2,})([\u4e00-\u9fff（(][\s\S]*?)(?=(?:\n\s*\d{2,}[\u4e00-\u9fff（(]|\n\s*\d{1,4}\s+[1-4OXox](?:\s+|(?=[\u4e00-\u9fff（(])))|\n(?:選擇題|是非題|複選題|問答題)\s*(?:\n|$)|$)/g;

const TF_BLOCK_RE =
  /(?:^|\n)\s*(\d{1,4})\s+([OXox])(?:\s+|(?=[\u4e00-\u9fff（(]))([\s\S]*?)(?=(?:\n\s*\d{1,4}\s+[1-4OXox](?:\s+|(?=[\u4e00-\u9fff（(])))|\n(?:選擇題|是非題|複選題|問答題)\s*(?:\n|$)|$)/g;

const QUESTION_TYPE_RE = /^(選擇題|是非題|複選題|問答題)$/;

/** 正式題庫分類（僅此 14 類；「第 N 條」不得當分類） */
export const OFFICIAL_QUESTION_BANK_CATEGORIES = [
  "政府採購全生命週期概論",
  "政府採購法之總則、招標及決標",
  "政府採購法之履約管理及驗收",
  "政府採購法之罰則及附則",
  "政府採購法之爭議處理",
  "底價及價格分析",
  "投標須知及招標文件製作",
  "採購契約",
  "最有利標及評選優勝廠商",
  "電子採購實務",
  "工程及技術服務採購作業",
  "財物及勞務採購作業",
  "錯誤採購態樣",
  "道德規範及違法處置",
] as const;

const OFFICIAL_CATEGORY_SET = new Set<string>(OFFICIAL_QUESTION_BANK_CATEGORIES);

/** 舊別名／關鍵詞分類 → 正式 14 類 */
const CATEGORY_ALIASES: Record<string, string> = {
  最有利標: "最有利標及評選優勝廠商",
  採購人員倫理: "道德規範及違法處置",
  金額門檻: "政府採購法之總則、招標及決標",
  未達公告金額: "政府採購法之總則、招標及決標",
  招標期限: "政府採購法之總則、招標及決標",
  議價比減: "政府採購法之總則、招標及決標",
};

const TRUNCATED_END_RE = /[之的與及或為應其於以、，；：]$/;
const TRUNCATED_START_RE = /^(?:[條之的與及或為應其於以、，。；]|[)）]|(?:[(（]\s*[34]\s*[)）])|以下若干|以上)/;

export type RawParsedQuestion = {
  number: string;
  category: string;
  questionType: string;
  questionLines: string[];
  answer?: string;
};

export function normalizePdfText(raw: string): string {
  let text = raw
    .replace(/\uFEFF/g, "")
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u3000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const newlineCount = (text.match(/\n/g) ?? []).length;
  if (newlineCount < text.length / 120) {
    text = text
      .replace(/(\d{1,4})\s+([1-4]|[OXox])(?=\s|[\u4e00-\u9fff（(])/g, "\n$1 $2 ")
      .replace(/(\d{2,})([1-4])(?=[\u4e00-\u9fff（(])/g, "\n$1$2");
  }

  return text.trim();
}

function slugifyCategory(parts: string[]): string {
  const base = parts.filter(Boolean).join("-") || "題庫";
  return base
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function isArticleSection(line: string): boolean {
  return /^第\s*\d{1,3}\s*條$/.test(line.trim());
}

/** 依條號歸入採購法四大篇章（PDF 以條號當頁眉，不可當分類） */
export function categoryForArticleNumber(articleNo: number): string {
  if (articleNo >= 63 && articleNo <= 73) return "政府採購法之履約管理及驗收";
  if (articleNo >= 74 && articleNo <= 86) return "政府採購法之爭議處理";
  if (articleNo >= 87) return "政府採購法之罰則及附則";
  return "政府採購法之總則、招標及決標";
}

/** 正規化為正式 14 類；無法對應則回傳 null */
export function normalizeToOfficialCategory(raw: string): string | null {
  const base = sectionBase(raw);
  if (!base || base === "題庫") return null;
  if (OFFICIAL_CATEGORY_SET.has(base)) return base;
  if (CATEGORY_ALIASES[base]) return CATEGORY_ALIASES[base]!;
  const art = base.match(/^第\s*(\d{1,3})\s*條$/);
  if (art) return categoryForArticleNumber(Number.parseInt(art[1]!, 10));
  return null;
}

export function isSectionTitle(line: string): boolean {
  // 僅承認正式 14 類章節標題，避免題幹斷行／條號頁眉污染分類
  return OFFICIAL_CATEGORY_SET.has(line.trim());
}

function endsTruncated(question: string): boolean {
  const q = question.replace(/\s+/g, "").trim();
  if (!q) return true;
  // 句中標點／連詞收尾，常見於 PDF 換頁截斷
  if (/[，、：；]$/.test(q)) return true;
  if (TRUNCATED_END_RE.test(q)) return true;
  return false;
}

export function isLikelyIncompleteQuestion(question: string): boolean {
  const q = question.replace(/\s+/g, "").trim();
  if (q.length < 12) return true;
  if (TRUNCATED_START_RE.test(q)) return true;
  if (endsTruncated(q)) return true;
  // 選擇題從選項 3/4 開頭 → 題幹被截斷
  if (/^[(（]\s*[34]\s*[)）]/.test(q)) return true;
  // 是非／選擇題開頭像條文續句
  if (/^條(第|及|至|規定)/.test(q)) return true;
  // 頁中被切斷後的續句（無題號、無「下列」起首）
  if (/^(?:方得|得為|始得|不得|應|其|並|或|及|且)/.test(q) && !/[？?]/.test(q)) {
    return true;
  }
  return false;
}

/** pdf table columns merged: 13下列… → 題1答案3；101關於… → 題10答案1 */
function matchConcatenatedQuestionLine(
  line: string,
): { num: string; ans: string; rest: string; mc: boolean } | null {
  const hit = line.match(/^(\d+)([\u4e00-\u9fff（(].*)$/);
  if (!hit) return null;
  const digitRun = hit[1]!;
  const rest = hit[2]!;
  if (digitRun.length < 2) return null;

  const ans = digitRun.slice(-1);
  const num = digitRun.slice(0, -1);
  if (!num || num.startsWith("0")) return null;
  // 不合理題號（掃描噪訊）捨棄
  if (Number.parseInt(num, 10) > 400) return null;

  if (/[1-4]/.test(ans)) {
    return { num, ans, rest, mc: true };
  }
  if (/[OXox]/.test(ans)) {
    return { num, ans, rest, mc: false };
  }
  return null;
}

function matchQuestionLine(
  line: string,
): { num: string; ans: string; rest: string; mc: boolean } | null {
  const mc = line.match(MC_LINE_RE);
  if (mc) {
    return { num: mc[1]!, ans: mc[2]!, rest: (mc[3] ?? "").trim(), mc: true };
  }
  const tf = line.match(TF_LINE_RE);
  if (tf) {
    return { num: tf[1]!, ans: tf[2]!, rest: (tf[3] ?? "").trim(), mc: false };
  }
  return matchConcatenatedQuestionLine(line);
}

function makeQuestion(
  num: string,
  ans: string,
  rest: string,
  mc: boolean,
  sectionTitle: string,
  questionType: string,
): RawParsedQuestion {
  const category = `${sectionTitle}｜${questionType}`;
  return {
    number: num,
    category,
    questionType,
    questionLines: rest ? [rest] : [],
    answer: mc ? ans : ans.toUpperCase() === "O" ? "O（是）" : "X（非）",
  };
}

function joinQuestionBody(lines: string[]): string {
  return lines.join("").replace(/\s+/g, " ").trim();
}

function optionCount(question: string): number {
  return (question.match(/\(\s*[1-4]\s*\)/g) ?? []).length;
}

function looksCompleteQuestion(question: string, questionType: string): boolean {
  const q = question.replace(/\s+/g, " ").trim();
  if (q.length < 15) return false;
  if (endsTruncated(q)) return false;
  if (questionType === "是非題") {
    return /[。．！？?]$/.test(q) || q.length >= 20;
  }
  const opts = optionCount(q);
  const compact = q.replace(/\s+/g, "");
  const endsClean = /[。．！？?）)]$/.test(compact);
  // 4 選項：標準完整；2–3 選項且有問句、收尾乾淨：視為完整以免殘片誤併
  if (opts >= 4) return true;
  return opts >= 2 && /[？?]/.test(q) && endsClean;
}

/** 將疑似截斷的題目併回「尚未完整」的上一題；已完整者則丟棄殘片 */
export function mergeIncompleteQuestions(items: RawParsedQuestion[]): RawParsedQuestion[] {
  const out: RawParsedQuestion[] = [];
  for (const item of items) {
    const body = joinQuestionBody(item.questionLines);
    const prev = out.length > 0 ? out[out.length - 1]! : null;
    const prevBody = prev ? joinQuestionBody(prev.questionLines) : "";
    const prevNeedsMore = Boolean(
      prev && (!looksCompleteQuestion(prevBody, prev.questionType) || endsTruncated(prevBody)),
    );

    if (prevNeedsMore && (isLikelyIncompleteQuestion(body) || endsTruncated(prevBody))) {
      prev!.questionLines.push(...item.questionLines);
      continue;
    }

    if (isLikelyIncompleteQuestion(body)) {
      // 孤立殘片：丟棄，避免污染下一題
      continue;
    }

    out.push({
      ...item,
      questionLines: [...item.questionLines],
    });
  }
  return out;
}

/** 頁首重複章節不應切斷正在組裝的題目；條號另以 isArticleSection 略過 */
function shouldIgnoreSectionTitle(
  line: string,
  sectionTitle: string,
  current: RawParsedQuestion | null,
): boolean {
  if (line === sectionTitle) return true;
  if (!current) return false;
  const body = joinQuestionBody(current.questionLines);
  if (looksCompleteQuestion(body, current.questionType)) return false;
  // 未完題中插入的正式章節標題多為頁眉重複
  return OFFICIAL_CATEGORY_SET.has(line);
}

function parseQuestionBankLines(text: string): RawParsedQuestion[] {
  const lines = normalizePdfText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let sectionTitle = "題庫";
  let questionType = "選擇題";
  const items: RawParsedQuestion[] = [];
  let current: RawParsedQuestion | null = null;

  const flush = () => {
    if (!current) return;
    const body = joinQuestionBody(current.questionLines);
    if (body.length >= 4) items.push(current);
    current = null;
  };

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;
    // 條號頁眉：不切斷題目、不寫入題幹、不改分類
    if (isArticleSection(line)) continue;

    if (QUESTION_TYPE_RE.test(line)) {
      flush();
      questionType = line;
      continue;
    }

    if (isSectionTitle(line)) {
      if (shouldIgnoreSectionTitle(line, sectionTitle, current)) {
        continue;
      }
      flush();
      sectionTitle = line;
      continue;
    }

    const hit = matchQuestionLine(line);
    if (hit) {
      flush();
      current = makeQuestion(hit.num, hit.ans, hit.rest, hit.mc, sectionTitle, questionType);
      continue;
    }

    if (current) {
      current.questionLines.push(line);
    }
  }

  flush();
  return mergeIncompleteQuestions(items);
}

function lookupContextBefore(
  normalized: string,
  start: number,
): { sectionTitle: string; questionType: string } {
  let sectionTitle = "題庫";
  let questionType = "選擇題";
  for (const line of normalized.slice(0, start).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || SKIP_LINE.test(trimmed) || isArticleSection(trimmed)) continue;
    if (QUESTION_TYPE_RE.test(trimmed)) questionType = trimmed;
    else if (isSectionTitle(trimmed)) sectionTitle = trimmed;
  }
  return { sectionTitle, questionType };
}

function parseQuestionBankBlocks(text: string): RawParsedQuestion[] {
  const normalized = normalizePdfText(text);
  const items: RawParsedQuestion[] = [];
  const seen = new Set<string>();

  for (const re of [MC_BLOCK_RE, TF_BLOCK_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(normalized)) !== null) {
      const num = m[1]!;
      const ans = m[2]!;
      const rest = (m[3] ?? "").replace(/\s+/g, " ").trim();
      if (rest.length < 4) continue;

      const dedupeKey = `${num}:${ans}:${rest.slice(0, 40)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const mc = re === MC_BLOCK_RE;
      const ctx = lookupContextBefore(normalized, m.index);
      items.push(makeQuestion(num, ans, rest, mc, ctx.sectionTitle, ctx.questionType));
    }
  }

  MC_CONCAT_BLOCK_RE.lastIndex = 0;
  let concat: RegExpExecArray | null;
  while ((concat = MC_CONCAT_BLOCK_RE.exec(normalized)) !== null) {
    const digitRun = concat[1]!;
    const rest = (concat[2] ?? "").replace(/\s+/g, " ").trim();
    if (digitRun.length < 2 || rest.length < 4) continue;

    const ans = digitRun.slice(-1);
    if (!/[1-4]/.test(ans)) continue;
    const num = digitRun.slice(0, -1);
    if (!num || num.startsWith("0")) continue;
    if (Number.parseInt(num, 10) > 400) continue;

    const dedupeKey = `${num}:${ans}:${rest.slice(0, 40)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const ctx = lookupContextBefore(normalized, concat.index);
    items.push(makeQuestion(num, ans, rest, true, ctx.sectionTitle, ctx.questionType));
  }

  return mergeIncompleteQuestions(items);
}

function parseSplitColumnLines(text: string): RawParsedQuestion[] {
  const lines = normalizePdfText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let sectionTitle = "題庫";
  let questionType = "選擇題";
  const items: RawParsedQuestion[] = [];
  let pendingNum: string | null = null;
  let pendingAns: string | null = null;
  let current: RawParsedQuestion | null = null;

  const flush = () => {
    if (!current) return;
    const body = joinQuestionBody(current.questionLines);
    if (body.length >= 4) items.push(current);
    current = null;
  };

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;
    if (isArticleSection(line)) continue;

    if (QUESTION_TYPE_RE.test(line)) {
      flush();
      pendingNum = null;
      pendingAns = null;
      questionType = line;
      continue;
    }

    if (isSectionTitle(line)) {
      if (shouldIgnoreSectionTitle(line, sectionTitle, current)) {
        continue;
      }
      flush();
      pendingNum = null;
      pendingAns = null;
      sectionTitle = line;
      continue;
    }

    const inline = matchQuestionLine(line);
    if (inline) {
      flush();
      pendingNum = null;
      pendingAns = null;
      current = makeQuestion(
        inline.num,
        inline.ans,
        inline.rest,
        inline.mc,
        sectionTitle,
        questionType,
      );
      continue;
    }

    if (/^(\d{1,4})\s+([1-4OXox])$/.test(line)) {
      flush();
      const m = line.match(/^(\d{1,4})\s+([1-4OXox])$/)!;
      pendingNum = m[1]!;
      pendingAns = m[2]!;
      continue;
    }

    if (/^\d{1,4}$/.test(line) && !pendingNum) {
      flush();
      pendingNum = line;
      pendingAns = null;
      continue;
    }

    if (pendingNum && /^[1-4OXox]$/.test(line)) {
      pendingAns = line;
      continue;
    }

    if (pendingNum && pendingAns && line.length >= 4) {
      flush();
      const mc = /^[1-4]$/.test(pendingAns);
      current = makeQuestion(pendingNum, pendingAns, line, mc, sectionTitle, questionType);
      pendingNum = null;
      pendingAns = null;
      continue;
    }

    if (current) {
      current.questionLines.push(line);
      continue;
    }

    pendingNum = null;
    pendingAns = null;
  }

  flush();
  return mergeIncompleteQuestions(items);
}

export function parseQuestionBankText(text: string): RawParsedQuestion[] {
  const fromLines = parseQuestionBankLines(text);
  if (fromLines.length > 0) return fromLines;

  const fromSplit = parseSplitColumnLines(text);
  if (fromSplit.length > 0) return fromSplit;

  return parseQuestionBankBlocks(text);
}

const STOP_KEYWORDS = new Set([
  "下列",
  "何者",
  "何種",
  "是否",
  "可以",
  "應",
  "得",
  "不得",
  "有關",
  "關於",
  "本題",
  "敘述",
  "機關",
  "廠商",
  "下列敘述何者錯誤",
  "下列敘述何者正確",
  "下列何者正確",
  "下列何者錯誤",
]);

/** 語意概念詞（優先於機械字數切塊）；與 src/lib/concept-tags.ts 對齊精簡版 */
const CONCEPT_LEXICON = [
  "總價結算",
  "契約變更",
  "技術服務費",
  "履約期限",
  "限制性招標",
  "採購評選委員會",
  "評選委員會",
  "公告金額",
  "查核金額",
  "巨額採購",
  "小額採購",
  "未達公告金額",
  "公開招標",
  "選擇性招標",
  "公開評選",
  "最有利標",
  "最低標",
  "底價",
  "價格分析",
  "押標金",
  "保證金",
  "履約保證金",
  "廠商資格",
  "履約管理",
  "驗收",
  "採購契約",
  "設計圖說",
  "專案管理",
  "技術服務",
  "資訊服務",
  "會同監辦",
  "異議",
  "申訴",
  "調解",
  "等標期",
  "招標文件",
  "電子投標",
  "電子採購",
  "契約價金",
  "建造費用",
].sort((a, b) => b.length - a.length);

function isTruncatedChunk(k: string): boolean {
  if (/^[\u4e00-\u9fff]{10}$/.test(k)) return true;
  return k.length >= 8 && /[之於與及或而規丈內所為後]$/.test(k);
}

export function extractKeywords(question: string): string[] {
  const terms = new Set<string>();

  for (const term of CONCEPT_LEXICON) {
    if (question.includes(term)) terms.add(term);
  }

  // 後備：僅保留短詞且排除機械截斷碎句（不再用固定 10 字切塊）
  const phrases = question.match(/[\u4e00-\u9fff]{2,7}/g) ?? [];
  for (const p of phrases) {
    if (STOP_KEYWORDS.has(p)) continue;
    if (isTruncatedChunk(p)) continue;
    // 避免把整句拆成大量重疊碎片：只收較短且非截斷尾字的詞
    if (p.length >= 3 && p.length <= 6 && !/[之於與及或而]$/.test(p)) {
      terms.add(p);
    }
  }

  // 優先輸出語意詞彙中的標籤
  const lexiconHits = CONCEPT_LEXICON.filter((t) => terms.has(t));
  const extras = [...terms].filter((t) => !lexiconHits.includes(t));
  const picked: string[] = [];
  for (const t of [...lexiconHits, ...extras]) {
    if (STOP_KEYWORDS.has(t)) continue;
    if (picked.some((x) => x.includes(t) || t.includes(x))) continue;
    picked.push(t);
    if (picked.length >= 10) break;
  }
  return picked.length > 0 ? picked : ["政府採購"];
}

const SLUG_RULES: Array<{ pattern: RegExp; slugs: string[]; category?: string }> = [
  {
    pattern: /查核金額|公告金額|巨額|金額門檻|小額採購|採購金額/,
    slugs: ["government-procurement-act", "gpa-enforcement-rules", "pcc-procurement-amount-thresholds"],
    category: "政府採購法之總則、招標及決標",
  },
  {
    pattern: /議價|比減|減價|限制性招標|協商|洽減/,
    slugs: ["government-procurement-act", "gpa-enforcement-rules"],
    category: "政府採購法之總則、招標及決標",
  },
  {
    pattern: /未達公告金額|公開取得報價單/,
    slugs: ["below-threshold-bidding-rules", "below-threshold-supervision-rules"],
    category: "政府採購法之總則、招標及決標",
  },
  {
    pattern: /最有利標|評選|最低標/,
    slugs: ["government-procurement-act", "most-advantageous-tender-selection-rules"],
    category: "最有利標及評選優勝廠商",
  },
  {
    pattern: /等標期|招標期限/,
    slugs: ["bidding-deadline-standards", "government-procurement-act"],
    category: "投標須知及招標文件製作",
  },
  {
    pattern: /押標金|保證金|履約保證/,
    slugs: ["bid-bond-guarantee-operations-rules", "government-procurement-act"],
  },
  {
    pattern: /廠商資格|登記|停權/,
    slugs: ["vendor-qualification-standards", "government-procurement-act"],
  },
  {
    pattern: /技術服務|監造|設計服務|建造費用百分比/,
    slugs: ["technical-service-selection-billing-rules", "government-procurement-act"],
    category: "工程及技術服務採購作業",
  },
  {
    pattern: /資訊服務|勞務採購|財物採購/,
    slugs: ["government-procurement-act", "gpa-enforcement-rules"],
    category: "財物及勞務採購作業",
  },
  {
    pattern: /倫理|饋贈|招待/,
    slugs: ["government-procurement-act"],
    category: "道德規範及違法處置",
  },
  {
    pattern: /電子領標|電子投標|電子採購/,
    slugs: ["government-procurement-act"],
    category: "電子採購實務",
  },
  {
    pattern: /異議|申訴|調解|爭議處理/,
    slugs: ["government-procurement-act"],
    category: "政府採購法之爭議處理",
  },
  {
    pattern: /底價|價格分析/,
    slugs: ["government-procurement-act", "gpa-enforcement-rules"],
    category: "底價及價格分析",
  },
  {
    pattern: /採購契約|契約要項/,
    slugs: ["procurement-contract-essentials", "government-procurement-act"],
    category: "採購契約",
  },
];

function sectionBase(fallbackCategory: string): string {
  return (fallbackCategory.split("｜")[0] ?? fallbackCategory).trim() || "題庫";
}

export function isGoodCategory(category: string): boolean {
  return normalizeToOfficialCategory(category) !== null;
}

export function inferSlugsAndCategory(
  question: string,
  fallbackCategory: string,
): { relatedSlugs: string[]; category: string } {
  const section = normalizeToOfficialCategory(fallbackCategory);

  let relatedSlugs = ["government-procurement-act", "gpa-enforcement-rules"];
  let keywordCategory: string | null = null;
  for (const rule of SLUG_RULES) {
    if (rule.pattern.test(question)) {
      relatedSlugs = rule.slugs;
      if (rule.category) {
        keywordCategory = normalizeToOfficialCategory(rule.category) ?? rule.category;
      }
      break;
    }
  }

  // 正式章節標題優先，避免關鍵詞覆寫整章分類
  if (section) {
    return { relatedSlugs, category: section };
  }
  if (keywordCategory && OFFICIAL_CATEGORY_SET.has(keywordCategory)) {
    return { relatedSlugs, category: keywordCategory };
  }
  return { relatedSlugs, category: "政府採購全生命週期概論" };
}

export function toQuestionBankEntry(raw: RawParsedQuestion): QuestionBankEntry | null {
  const questionBody = joinQuestionBody(raw.questionLines);
  if (questionBody.length < 12) return null;
  if (isLikelyIncompleteQuestion(questionBody)) return null;
  if (endsTruncated(questionBody)) return null;
  if (raw.questionType === "選擇題") {
    const opts = optionCount(questionBody);
    // 明顯截斷：選擇題應至少有 3 個選項標記，否則多為 PDF 斷行殘缺
    if (opts > 0 && opts < 3) return null;
    // 僅 3 個選項且未以句號／括號收尾 → 多半缺選項 (4)
    if (opts === 3 && !/[。．！？?）)]$/.test(questionBody.replace(/\s+/g, "").trim())) {
      return null;
    }
  }

  const { relatedSlugs, category } = inferSlugsAndCategory(questionBody, raw.category);
  const keywords = extractKeywords(questionBody);

  let hintAnswer: string | undefined;
  if (raw.answer) {
    const ansLabel =
      raw.questionType === "是非題" ? raw.answer : `選項 (${raw.answer})`;
    hintAnswer = `【題庫】本題參考答案為 ${ansLabel}。正式作答須以檢索到的法規／函釋全文為準，勿僅依題庫背誦。`;
  }

  const typeSlug =
    raw.questionType === "是非題"
      ? "tf"
      : raw.questionType === "選擇題"
        ? "mc"
        : slugifyCategory([raw.questionType]);
  const catSlug = slugifyCategory([category]) || "topic";
  const key = `gpa-${catSlug}-${typeSlug}-${raw.number.padStart(4, "0")}`;

  return {
    key,
    question: questionBody,
    keywords,
    relatedSlugs,
    category,
    hintAnswer,
  };
}

export function rawToEntries(rawItems: RawParsedQuestion[]): QuestionBankEntry[] {
  const byKey = new Map<string, QuestionBankEntry>();
  for (const raw of mergeIncompleteQuestions(rawItems)) {
    const entry = toQuestionBankEntry(raw);
    if (!entry) continue;
    let key = entry.key;
    let dup = 2;
    while (byKey.has(key)) {
      key = `${entry.key}-d${dup++}`;
    }
    byKey.set(key, { ...entry, key });
  }
  return [...byKey.values()];
}
