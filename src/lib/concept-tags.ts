/**
 * 前台用「概念標籤」：語意完整的採購法概念詞＋條次款項。
 * 題庫 JSON 內的 keywords 常由固定字數機械切出，僅供後台檢索，不宜直接展示。
 */

/** 條／項／款標籤（例：第22條第1項第7款） */
const ARTICLE_CLAUSE_RE =
  /第\s*\d+\s*條(?:\s*之\s*\d+)?(?:\s*第\s*\d+\s*項)?(?:\s*第\s*\d+\s*款)?/g;

/** 受控概念詞彙（最長優先比對） */
export const CONCEPT_TAG_LEXICON: readonly string[] = [
  // 使用者建議示例（前台優先）
  "技術服務費",
  "廠商資格",
  "總價結算",
  "契約變更",
  "逾期違約金",
  "限制性招標",
  "採購評選委員會",
  "履約期限",
  // 金額／門檻
  "公告金額",
  "查核金額",
  "巨額採購",
  "小額採購",
  "未達公告金額",
  "採購金額",
  "金額門檻",
  "金額級距",
  // 招標方式
  "公開招標",
  "選擇性招標",
  "公開評選",
  "公開取得報價單",
  "電子招標",
  "電子投標",
  "電子領標",
  "電子採購",
  "統包",
  "共同供應契約",
  // 決標／評選
  "最有利標",
  "最低標",
  "複數決標",
  "評選委員會",
  "評選辦法",
  "決標原則",
  "底價",
  "價格分析",
  "超底價",
  "比減價格",
  "議價",
  "減價",
  // 保證／資格／時程
  "押標金退還",
  "押標金",
  "保證金",
  "履約保證金",
  "特定資格",
  "基本資格",
  "合格廠商",
  "拒絕往來廠商",
  "招標公告時程",
  "招標公告",
  "異議與申訴期限",
  "異議期限",
  "申訴期限",
  // 履約／契約
  "履約管理",
  "驗收",
  "保固",
  "遲延履約",
  "違約金",
  "契約價金",
  "採購契約",
  "設計圖說",
  "專案管理",
  "技術服務",
  "資訊服務",
  "勞務採購",
  "財物採購",
  "工程採購",
  "室內裝修",
  // 監辦／爭議
  "會同監辦",
  "上級機關",
  "異議",
  "申訴",
  "調解",
  "爭議處理",
  // 其他高頻
  "等標期",
  "招標期限",
  "招標文件",
  "投標須知",
  "開標",
  "流標",
  "廢標",
  "決標",
  "暫停採購",
  "停權",
  "利益衝突",
  "採購人員倫理",
  "錯誤採購態樣",
  "建造費用",
  "監造",
  "可行性評估",
]
  .slice()
  .sort((a, b) => b.length - a.length || a.localeCompare(b, "zh-Hant"));

const LEXICON_SET = new Set(CONCEPT_TAG_LEXICON);

/** 前台不應展示的題幹套語／虛詞片語 */
const DISPLAY_STOP = new Set([
  "下列",
  "何者",
  "何種",
  "是否",
  "敘述",
  "下列敘述",
  "下列敘述何者錯誤",
  "下列敘述何者正確",
  "下列何者正確",
  "下列何者錯誤",
  "下列何者有誤",
  "以上皆非",
  "以上皆是",
  "本題",
  "有關",
  "關於",
  "機關",
  "廠商",
  "服務",
  "格得為何",
]);

/** 機械切塊常見：不完整語助／介詞／截斷尾字 */
const TRUNCATION_TAIL = /[之於與及或而規丈內所為後資得何]$/;

export function isMechanicalKeyword(raw: string): boolean {
  const k = raw.trim();
  if (!k) return true;
  if (DISPLAY_STOP.has(k)) return true;
  if (LEXICON_SET.has(k)) return false;
  // 解析器曾用 {2,10} 貪婪切中文 → 大量剛好 9～12 字的碎句
  if (/^[\u4e00-\u9fff]{9,12}$/.test(k)) return true;
  if (k.length >= 8 && TRUNCATION_TAIL.test(k)) return true;
  // 非受控詞且過長：不當前台標籤
  if (k.length > 8) return true;
  return false;
}

/** 正規化條次款項字串（去空白） */
export function normalizeArticleClauseTag(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

/** 是否為條／項／款標籤 */
export function isArticleClauseTag(value: string): boolean {
  return /^第\d+條(之\d+)?(第\d+項)?(第\d+款)?$/.test(normalizeArticleClauseTag(value));
}

/**
 * 自題幹／解析擷取條次款項標籤（例：第22條第1項第7款）。
 * 較長匹配優先：已有「第22條第1項第7款」時不再另加「第22條」。
 */
export function extractArticleClauseTags(
  text: string | null | undefined,
  max = 6,
): string[] {
  if (!text?.trim()) return [];
  const found: string[] = [];
  for (const m of text.matchAll(ARTICLE_CLAUSE_RE)) {
    const tag = normalizeArticleClauseTag(m[0] ?? "");
    if (!tag || found.includes(tag)) continue;
    // 略過已被更長條次涵蓋者
    if (found.some((x) => x.startsWith(tag) && x.length > tag.length)) continue;
    // 若新標籤更長且涵蓋既有短標，替換
    for (let i = found.length - 1; i >= 0; i--) {
      const prev = found[i]!;
      if (tag.startsWith(prev) && tag.length > prev.length) found.splice(i, 1);
    }
    found.push(tag);
    if (found.length >= max) break;
  }
  return found.slice(0, max);
}

/**
 * 前台專用：只回傳受控「概念標籤」，永不回傳機械切塊 keywords。
 */
export function extractConceptTags(input: {
  question?: string | null;
  keywords?: string[] | null;
  category?: string | null;
  max?: number;
}): string[] {
  const max = input.max ?? 8;
  // 仍讀取 keywords 字串僅為了從中辨識受控詞（若剛好存成完整概念詞）
  const blob = [input.question ?? "", ...(input.keywords ?? [])].join("\n");
  const out: string[] = [];

  const push = (tag: string) => {
    const t = tag.trim();
    if (!t || !LEXICON_SET.has(t) || DISPLAY_STOP.has(t) || out.includes(t)) return;
    // 已有較長概念詞時略過其子字串（如已有「技術服務費」則不再加「技術服務」）
    if (out.some((x) => x.includes(t) || t.includes(x))) return;
    out.push(t);
  };

  for (const term of CONCEPT_TAG_LEXICON) {
    if (blob.includes(term)) push(term);
    if (out.length >= max) break;
  }

  if (input.category && LEXICON_SET.has(input.category) && out.length < max) {
    push(input.category);
  }

  return out.slice(0, max);
}

/**
 * 題目完整概念標籤＝條次款項 ∪ 受控概念詞（供知識圖譜／診斷書）。
 */
export function resolveQuestionConceptTags(input: {
  question?: string | null;
  keywords?: string[] | null;
  category?: string | null;
  explanation?: string | null;
  max?: number;
}): string[] {
  const max = input.max ?? 12;
  const blob = [input.question ?? "", input.explanation ?? "", ...(input.keywords ?? [])].join(
    "\n",
  );
  const articles = extractArticleClauseTags(blob, Math.min(6, max));
  const concepts = extractConceptTags({
    question: blob,
    keywords: input.keywords,
    category: input.category,
    max: Math.max(0, max - articles.length),
  });
  const out: string[] = [...articles];
  for (const c of concepts) {
    if (!out.includes(c)) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/** 後端檢索擴展：優先概念標籤；keywords 僅在非機械切塊時輔助 */
export function keywordsForRetrieval(input: {
  question?: string | null;
  keywords?: string[] | null;
  max?: number;
}): string[] {
  const concepts = extractConceptTags({ ...input, max: input.max ?? 12 });
  const extras: string[] = [];
  for (const kw of input.keywords ?? []) {
    const t = kw.trim();
    if (isMechanicalKeyword(t)) continue;
    if (concepts.includes(t) || extras.includes(t)) continue;
    if (LEXICON_SET.has(t) || (t.length >= 2 && t.length <= 6)) extras.push(t);
    if (concepts.length + extras.length >= (input.max ?? 12)) break;
  }
  return [...concepts, ...extras].slice(0, input.max ?? 12);
}
