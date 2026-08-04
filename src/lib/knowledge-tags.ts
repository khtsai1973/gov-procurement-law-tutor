/**
 * 題庫知識標籤（Knowledge Tagging）— 受控詞彙＋規則推導。
 * 供確定性雷達圖與 LLM 弱點建議共用，避免僅依賴自由文字 keywords。
 */

import { OFFICIAL_QUESTION_BANK_CATEGORIES } from "@/lib/question-bank-categories";

/** 雷達圖／診斷用的知識軸（精簡、穩定） */
export const KNOWLEDGE_TAG_AXES = [
  "招標程序",
  "決標與評選",
  "金額門檻",
  "廠商資格",
  "履約驗收",
  "爭議處理",
  "罰則倫理",
  "採購契約",
  "電子採購",
  "錯誤態樣",
] as const;

export type KnowledgeTag = (typeof KNOWLEDGE_TAG_AXES)[number];

const AXIS_SET = new Set<string>(KNOWLEDGE_TAG_AXES);

/** 正式 14 類 → 知識軸 */
const CATEGORY_TO_TAGS: Record<string, KnowledgeTag[]> = {
  "政府採購全生命週期概論": ["招標程序"],
  "政府採購法之總則、招標及決標": ["招標程序", "決標與評選", "金額門檻"],
  "政府採購法之履約管理及驗收": ["履約驗收"],
  "政府採購法之罰則及附則": ["罰則倫理"],
  "政府採購法之爭議處理": ["爭議處理"],
  "底價及價格分析": ["決標與評選", "金額門檻"],
  "投標須知及招標文件製作": ["招標程序", "廠商資格"],
  "採購契約": ["採購契約", "履約驗收"],
  "最有利標及評選優勝廠商": ["決標與評選"],
  "電子採購實務": ["電子採購"],
  "工程及技術服務採購作業": ["招標程序", "決標與評選"],
  "財物及勞務採購作業": ["招標程序", "金額門檻"],
  "錯誤採購態樣": ["錯誤態樣"],
  "道德規範及違法處置": ["罰則倫理"],
};

/** 關鍵詞／題幹規則 → 知識軸 */
const TEXT_TAG_RULES: { re: RegExp; tag: KnowledgeTag }[] = [
  { re: /公告金額|查核金額|巨額|小額採購|金額門檻|金額級距/, tag: "金額門檻" },
  { re: /最有利標|評選|評分|優勝廠商|公開評選/, tag: "決標與評選" },
  { re: /底價|價格分析|議價|比減|決標/, tag: "決標與評選" },
  { re: /招標|投標|開標|流標|廢標|等標期|招標文件/, tag: "招標程序" },
  { re: /廠商資格|特定資格|基本資格|合格廠商|拒絕往來|停權/, tag: "廠商資格" },
  { re: /履約|驗收|保固|遲延|契約變更/, tag: "履約驗收" },
  { re: /異議|申訴|調解|爭議|暫停採購/, tag: "爭議處理" },
  { re: /罰則|刑責|採購人員倫理|利益衝突|不當利益/, tag: "罰則倫理" },
  { re: /採購契約|契約條款|契約金/, tag: "採購契約" },
  { re: /電子採購|電子領標|電子投標/, tag: "電子採購" },
  { re: /錯誤採購|常見錯誤|違失/, tag: "錯誤態樣" },
];

const SLUG_TAG_RULES: { re: RegExp; tag: KnowledgeTag }[] = [
  { re: /threshold|amount|公告|查核|小額/, tag: "金額門檻" },
  { re: /most-advantageous|selection|評選/, tag: "決標與評選" },
  { re: /enforcement|施行細則|government-procurement-act/, tag: "招標程序" },
  { re: /supervision|監辦/, tag: "招標程序" },
  { re: /contract|契約/, tag: "採購契約" },
];

function pushUnique(out: string[], tag: string) {
  if (!AXIS_SET.has(tag)) return;
  if (!out.includes(tag)) out.push(tag);
}

/** 正規化顯式標籤；僅保留受控詞彙 */
export function normalizeKnowledgeTags(raw: string[] | null | undefined): KnowledgeTag[] {
  if (!raw?.length) return [];
  const out: KnowledgeTag[] = [];
  for (const t of raw) {
    const s = t.trim();
    if (AXIS_SET.has(s)) pushUnique(out, s);
  }
  return out as KnowledgeTag[];
}

export type TagSourceItem = {
  category: string;
  keywords?: string[] | null;
  relatedSlugs?: string[] | null;
  question?: string | null;
  knowledgeTags?: string[] | null;
};

/**
 * 解析題目知識標籤：顯式 tags ∪ 類別對應 ∪ 關鍵詞／題幹／slug 規則。
 * 至少回傳對應類別軸；無法對應時回傳「招標程序」。
 */
export function resolveKnowledgeTags(item: TagSourceItem): KnowledgeTag[] {
  const out: string[] = [];

  for (const t of normalizeKnowledgeTags(item.knowledgeTags)) {
    pushUnique(out, t);
  }

  const catTags = CATEGORY_TO_TAGS[item.category];
  if (catTags) {
    for (const t of catTags) pushUnique(out, t);
  } else if (
    (OFFICIAL_QUESTION_BANK_CATEGORIES as readonly string[]).includes(item.category)
  ) {
    pushUnique(out, "招標程序");
  }

  const blob = [item.question ?? "", ...(item.keywords ?? [])].join("\n");
  for (const rule of TEXT_TAG_RULES) {
    if (rule.re.test(blob)) pushUnique(out, rule.tag);
  }

  for (const slug of item.relatedSlugs ?? []) {
    for (const rule of SLUG_TAG_RULES) {
      if (rule.re.test(slug)) pushUnique(out, rule.tag);
    }
  }

  if (out.length === 0) pushUnique(out, "招標程序");
  return out as KnowledgeTag[];
}

export function isKnowledgeTag(value: string): value is KnowledgeTag {
  return AXIS_SET.has(value);
}
