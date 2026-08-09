/**
 * 前台用「概念標籤」：語意完整的採購法概念詞。
 * 題庫 JSON 內的 keywords 常由固定字數機械切出，不宜直接展示。
 */

/** 受控概念詞彙（最長優先比對） */
export const CONCEPT_TAG_LEXICON: readonly string[] = [
  // 使用者建議示例
  "總價結算",
  "契約變更",
  "技術服務費",
  "履約期限",
  "限制性招標",
  "採購評選委員會",
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
  // 保證／資格
  "押標金",
  "保證金",
  "履約保證金",
  "廠商資格",
  "特定資格",
  "基本資格",
  "合格廠商",
  "拒絕往來廠商",
  // 履約／契約
  "履約管理",
  "驗收",
  "保固",
  "遲延履約",
  "契約價金",
  "採購契約",
  "設計圖說",
  "專案管理",
  "技術服務",
  "資訊服務",
  "勞務採購",
  "財物採購",
  "工程採購",
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
].slice()
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
]);

/** 機械切塊常見：過長且以不完整語助／介詞結尾 */
const TRUNCATION_TAIL = /[之於與及或而規丈內所為後]$/;

export function isMechanicalKeyword(raw: string): boolean {
  const k = raw.trim();
  if (!k) return true;
  if (DISPLAY_STOP.has(k)) return true;
  if (LEXICON_SET.has(k)) return false;
  // 解析器曾用 {2,10} 貪婪切中文 → 大量剛好 10 字的碎句
  if (k.length >= 10 && TRUNCATION_TAIL.test(k)) return true;
  if (k.length >= 8 && TRUNCATION_TAIL.test(k)) return true;
  if (/^[\u4e00-\u9fff]{10}$/.test(k) && !LEXICON_SET.has(k)) return true;
  return false;
}

/**
 * 自題幹／既有 keywords 抽取語意完整的概念標籤（供前台展示）。
 */
export function extractConceptTags(input: {
  question?: string | null;
  keywords?: string[] | null;
  category?: string | null;
  max?: number;
}): string[] {
  const max = input.max ?? 8;
  const blob = [input.question ?? "", ...(input.keywords ?? [])].join("\n");
  const out: string[] = [];

  const push = (tag: string) => {
    const t = tag.trim();
    if (!t || DISPLAY_STOP.has(t) || out.includes(t)) return;
    out.push(t);
  };

  for (const term of CONCEPT_TAG_LEXICON) {
    if (blob.includes(term)) push(term);
    if (out.length >= max) break;
  }

  // 既有 keywords 若本身就是受控概念詞，一併納入
  if (out.length < max) {
    for (const kw of input.keywords ?? []) {
      if (LEXICON_SET.has(kw.trim())) push(kw.trim());
      if (out.length >= max) break;
    }
  }

  // 類別名稱過長時不直接當標籤；若類別本身在詞彙中則加入
  if (input.category && LEXICON_SET.has(input.category) && out.length < max) {
    push(input.category);
  }

  return out.slice(0, max);
}

/** 後端檢索擴展：優先概念標籤，過濾機械切塊 */
export function keywordsForRetrieval(input: {
  question?: string | null;
  keywords?: string[] | null;
  max?: number;
}): string[] {
  const concepts = extractConceptTags({ ...input, max: input.max ?? 12 });
  const extras: string[] = [];
  for (const kw of input.keywords ?? []) {
    if (isMechanicalKeyword(kw)) continue;
    if (concepts.includes(kw) || extras.includes(kw)) continue;
    // 僅保留較短、像詞的片段
    if (kw.length >= 2 && kw.length <= 8) extras.push(kw);
    if (concepts.length + extras.length >= (input.max ?? 12)) break;
  }
  return [...concepts, ...extras].slice(0, input.max ?? 12);
}
