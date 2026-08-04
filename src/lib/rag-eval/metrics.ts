/**
 * Ragas 風格指標（TypeScript 啟發式實作，可離線重現）。
 *
 * - Faithfulness：回答主張是否可由 contexts／must_include 支撐
 * - Answer Relevance：回答是否對準問題（關鍵詞與主題重疊）
 * - Context Recall：金標 must_include 是否出現在檢索／金標上下文（檢索品質）
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/萬元/g, "0000")
    .replace(/,/g, "");
}

function includesLoose(haystack: string, needle: string): boolean {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return true;
  if (h.includes(n)) return true;
  // 數字容錯：5,000 / 5000 / 5千
  const digits = needle.replace(/[^\d]/g, "");
  if (digits.length >= 2 && h.includes(digits)) return true;
  return false;
}

/** 將回答切成可檢查的短句／條列 */
export function splitClaims(answer: string): string[] {
  return answer
    .split(/[\n。；;]+/)
    .map((s) => s.replace(/^[\d\.\)、\-\*\s]+/, "").trim())
    .filter((s) => s.length >= 6);
}

/**
 * Faithfulness ∈ [0,1]
 * 優先：must_include 覆蓋率；其次：短句是否能在 context 中找到支撐。
 */
export function scoreFaithfulness(params: {
  answer: string;
  contexts: string[];
  mustInclude?: string[];
}): number {
  const { answer, contexts, mustInclude = [] } = params;
  if (!answer.trim()) return 0;

  // 離題固定回覆：無上下文時視為忠實（未捏造法條）
  if (answer.trim() === "非本主題的範圍") {
    return contexts.length === 0 ? 1 : 0.9;
  }

  const corpus = contexts.join("\n\n");
  const mustScores =
    mustInclude.length === 0
      ? null
      : mustInclude.filter((m) => includesLoose(answer, m) && (corpus ? includesLoose(corpus, m) || includesLoose(answer, m) : true)).length /
        mustInclude.length;

  // must_include：答案含關鍵事實；若有 context，關鍵事實也應能在 context 對上（防幻覺）
  let mustFaith = 1;
  if (mustInclude.length > 0) {
    const inAnswer = mustInclude.filter((m) => includesLoose(answer, m));
    if (corpus) {
      const supported = inAnswer.filter((m) => includesLoose(corpus, m));
      // 答案有提但 context 沒有 → 扣分；答案沒提也扣分
      mustFaith = supported.length / mustInclude.length;
    } else {
      mustFaith = inAnswer.length / mustInclude.length;
    }
  }

  const claims = splitClaims(answer).slice(0, 12);
  let claimFaith = 1;
  if (claims.length > 0 && corpus) {
    let ok = 0;
    for (const c of claims) {
      // 取句中較具辨識度的 2～4 字詞片段
      const tokens = c.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t.length >= 2);
      const hits = tokens.filter((t) => includesLoose(corpus, t));
      if (hits.length >= Math.min(2, tokens.length) || includesLoose(corpus, c.slice(0, 24))) {
        ok += 1;
      }
    }
    claimFaith = ok / claims.length;
  }

  if (mustScores != null && corpus) {
    return clamp01(0.65 * mustFaith + 0.35 * claimFaith);
  }
  if (mustInclude.length > 0) return clamp01(mustFaith);
  return clamp01(claimFaith);
}

/**
 * Answer Relevance ∈ [0,1]
 * 問題關鍵詞是否出現在答案；並檢查是否離題胡扯。
 */
export function scoreAnswerRelevance(params: {
  question: string;
  answer: string;
  relevanceKeywords?: string[];
}): number {
  const { question, answer, relevanceKeywords = [] } = params;
  if (!answer.trim()) return 0;

  if (answer.trim() === "非本主題的範圍") {
    // 離題問題應得高相關（正確拒答）；採購問題卻拒答則低
    const looksOnTopic =
      /採購|招標|決標|公告|查核|監辦|廠商|採購法|金額/.test(question);
    return looksOnTopic ? 0.15 : 1;
  }

  const keys =
    relevanceKeywords.length > 0
      ? relevanceKeywords
      : extractQuestionKeywords(question);

  if (keys.length === 0) return 0.5;
  const hit = keys.filter((k) => includesLoose(answer, k)).length;
  const coverage = hit / keys.length;

  // 過短且無關
  if (answer.length < 12 && coverage < 0.34) return 0.2;
  return clamp01(coverage);
}

/** Context Recall：金標 must_include 出現在 contexts 的比例 */
export function scoreContextRecall(params: {
  contexts: string[];
  mustInclude: string[];
}): number | null {
  const { contexts, mustInclude } = params;
  if (mustInclude.length === 0) return null;
  if (contexts.length === 0) return 0;
  const corpus = contexts.join("\n");
  const hit = mustInclude.filter((m) => includesLoose(corpus, m)).length;
  return clamp01(hit / mustInclude.length);
}

export function extractQuestionKeywords(question: string): string[] {
  const candidates = [
    "查核金額",
    "公告金額",
    "小額採購",
    "採購金額",
    "公開招標",
    "限制性招標",
    "公開評選",
    "合格廠商",
    "會同監辦",
    "監辦",
    "後續擴充",
    "含稅",
    "第22條",
    "財物",
    "勞務",
    "工程",
  ];
  return candidates.filter((k) => question.includes(k));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
}

export function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000;
}
