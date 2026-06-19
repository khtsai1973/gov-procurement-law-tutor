/**
 * Parse plain text from 政府採購法規全部題庫.pdf
 * (工程會題庫格式：編號 + 答案欄 + 試題，選擇題答案為 1–4，是非題為 O/X)
 */
import type { QuestionBankEntry } from "../../src/lib/question-bank-types";

const SKIP_LINE =
  /^(?:資料產生日期|編|號|答|案|試|題|--\s*\d+\s+of\s+\d+\s*--|第\s*\d+\s*$|條\s*$)/;

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

const SECTION_LINE_RE =
  /^[\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9、（）()《》「」\-—\s]{1,48}$/;

const QUESTION_TYPE_RE = /^(選擇題|是非題|複選題|問答題)$/;

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
      .replace(
        /(\d{1,4})\s+([1-4]|[OXox])(?=\s|[\u4e00-\u9fff（(])/g,
        "\n$1 $2 ",
      )
      .replace(
        /(\d{2,})([1-4])(?=[\u4e00-\u9fff（(])/g,
        "\n$1$2",
      );
  }

  return text.trim();
}

function slugifyCategory(parts: string[]): string {
  const base = parts.filter(Boolean).join("-") || "題庫";
  return base
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function isSectionTitle(line: string): boolean {
  if (line.length < 3 || line.length > 50) return false;
  if (MC_LINE_RE.test(line) || TF_LINE_RE.test(line)) return false;
  if (SKIP_LINE.test(line)) return false;
  if (/^\d/.test(line)) return false;
  return SECTION_LINE_RE.test(line);
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

  if (/[1-4]/.test(ans)) {
    return { num, ans, rest, mc: true };
  }
  if (/[OXox]/.test(ans)) {
    return { num, ans, rest, mc: false };
  }
  return null;
}

function matchQuestionLine(line: string): { num: string; ans: string; rest: string; mc: boolean } | null {
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
    const body = current.questionLines.join("").trim();
    if (body.length >= 4) items.push(current);
    current = null;
  };

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;

    if (QUESTION_TYPE_RE.test(line)) {
      flush();
      questionType = line;
      continue;
    }

    if (isSectionTitle(line)) {
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
  return items;
}

function lookupContextBefore(
  normalized: string,
  start: number,
): { sectionTitle: string; questionType: string } {
  let sectionTitle = "題庫";
  let questionType = "選擇題";
  for (const line of normalized.slice(0, start).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || SKIP_LINE.test(trimmed)) continue;
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

    const dedupeKey = `${num}:${ans}:${rest.slice(0, 40)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const ctx = lookupContextBefore(normalized, concat.index);
    items.push(makeQuestion(num, ans, rest, true, ctx.sectionTitle, ctx.questionType));
  }

  return items;
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
    const body = current.questionLines.join("").trim();
    if (body.length >= 4) items.push(current);
    current = null;
  };

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;

    if (QUESTION_TYPE_RE.test(line)) {
      flush();
      pendingNum = null;
      pendingAns = null;
      questionType = line;
      continue;
    }

    if (isSectionTitle(line)) {
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
      current = makeQuestion(
        pendingNum,
        pendingAns,
        line,
        mc,
        sectionTitle,
        questionType,
      );
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
  return items;
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
]);

export function extractKeywords(question: string): string[] {
  const terms = new Set<string>();
  const phrases = question.match(/[\u4e00-\u9fff]{2,10}/g) ?? [];
  for (const p of phrases) {
    if (STOP_KEYWORDS.has(p)) continue;
    if (p.length >= 2 && p.length <= 10) terms.add(p);
  }
  const ordered = [...terms].sort((a, b) => b.length - a.length);
  const picked: string[] = [];
  for (const t of ordered) {
    if (picked.some((x) => x.includes(t) || t.includes(x))) continue;
    picked.push(t);
    if (picked.length >= 10) break;
  }
  if (picked.length === 0) {
    const short = question.slice(0, 30).replace(/\s/g, "");
    if (short.length >= 4) picked.push(short);
  }
  return picked.length > 0 ? picked : ["政府採購"];
}

const SLUG_RULES: Array<{ pattern: RegExp; slugs: string[]; category?: string }> = [
  {
    pattern: /查核金額|公告金額|巨額|金額門檻|小額採購|採購金額/,
    slugs: ["government-procurement-act", "gpa-enforcement-rules", "pcc-procurement-amount-thresholds"],
    category: "金額門檻",
  },
  {
    pattern: /議價|比減|減價|限制性招標|協商|洽減/,
    slugs: ["government-procurement-act", "gpa-enforcement-rules"],
    category: "議價比減",
  },
  {
    pattern: /未達公告金額|公開取得報價單/,
    slugs: ["below-threshold-bidding-rules", "below-threshold-supervision-rules"],
    category: "未達公告金額",
  },
  {
    pattern: /最有利標|評選|最低標/,
    slugs: ["government-procurement-act", "most-advantageous-tender-selection-rules"],
    category: "最有利標",
  },
  {
    pattern: /等標期|招標期限/,
    slugs: ["bidding-deadline-standards", "government-procurement-act"],
    category: "招標期限",
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
    pattern: /技術服務|監造|設計/,
    slugs: ["technical-service-selection-billing-rules", "government-procurement-act"],
  },
  {
    pattern: /倫理|饋贈|招待/,
    slugs: ["government-procurement-act"],
    category: "採購人員倫理",
  },
];

export function inferSlugsAndCategory(
  question: string,
  fallbackCategory: string,
): { relatedSlugs: string[]; category: string } {
  for (const rule of SLUG_RULES) {
    if (rule.pattern.test(question)) {
      return {
        relatedSlugs: rule.slugs,
        category: rule.category ?? fallbackCategory.split("｜")[0] ?? fallbackCategory,
      };
    }
  }
  return {
    relatedSlugs: ["government-procurement-act", "gpa-enforcement-rules"],
    category: fallbackCategory.split("｜")[0] ?? fallbackCategory,
  };
}

export function toQuestionBankEntry(raw: RawParsedQuestion): QuestionBankEntry {
  const questionBody = raw.questionLines.join("").trim();
  const { relatedSlugs, category } = inferSlugsAndCategory(questionBody, raw.category);
  const keywords = extractKeywords(questionBody);

  let hintAnswer: string | undefined;
  if (raw.answer) {
    const ansLabel =
      raw.questionType === "是非題"
        ? raw.answer
        : `選項 (${raw.answer})`;
    hintAnswer = `【題庫】本題參考答案為 ${ansLabel}。正式作答須以檢索到的法規／函釋全文為準，勿僅依題庫背誦。`;
  }

  const catSlug = slugifyCategory([raw.category]);
  const key = `gpa-${catSlug}-${raw.number.padStart(4, "0")}`;

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
  for (const raw of rawItems) {
    const entry = toQuestionBankEntry(raw);
    let key = entry.key;
    let dup = 2;
    while (byKey.has(key)) {
      key = `${entry.key}-dup${dup++}`;
    }
    byKey.set(key, { ...entry, key });
  }
  return [...byKey.values()];
}
