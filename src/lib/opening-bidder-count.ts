/**
 * 開標／投標合格廠商家數判定輔助。
 * 常見易混：公開招標第1次須3家 vs 第22條第1項第9款公開評選（僅限特定勞務）無3家限制。
 * 重要：第22條第1項第9款不適用財物採購、亦不適用工程採購。
 */

import { inferProcurementCategory, type ProcurementCategory } from "@/lib/amount-tier";

export type OpeningMode =
  | "public_tender"
  | "open_selection_restricted" // 第22條第1項第9款等（特定勞務）公開評選之限制性招標
  | "art22_9_inapplicable" // 誤用第9款於財物／工程
  | "selective_qualified_list"
  | "selective_case"
  | "unknown";

export type OpeningBidderAnalysis = {
  mode: OpeningMode;
  minQualifiedVendors: number | null;
  category: ProcurementCategory | null;
  /** 結論短句 */
  conclusion: string;
  guidance: string;
};

/** 第22條第1項第9款標的：專業／技術／資訊／社福服務（屬勞務） */
const ART22_9_SERVICES =
  /資訊服務|專業服務|技術服務|社會福利服務|公開客觀評選|委託.*服務/;

const OPEN_SELECTION_WORDS =
  /公開評選|公開客觀評選|第\s*22\s*條\s*第\s*1\s*項\s*第\s*9|第二十二條\s*第\s*一\s*項\s*第\s*九|22\s*條.*第\s*9\s*款|限制性招標.*公開評選|公開評選.*限制性招標|經公開評選/;

const MENTIONS_ART22 = /第\s*22\s*條|第二十二條/;

const PUBLIC_TENDER = /公開招標/;
const SELECTIVE_LIST = /選擇性招標.*合格廠商名單|建立合格廠商名單|經常性採購.*選擇性/;
const SELECTIVE_CASE = /選擇性招標|個案.*選擇性/;

const ASKS_BIDDER_COUNT =
  /幾家|家數|至少.*家|須有.*家|要有.*家|合格廠商|方可開標|始得開標|才能開標|開標.*家/;

const GOODS_OR_WORKS = /財物|財務|工程/; // 財務為常見誤寫，視同財物

export function isOpeningBidderCountQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return (
    ASKS_BIDDER_COUNT.test(q) &&
    (/開標|投標|招標|評選/.test(q) || OPEN_SELECTION_WORDS.test(q) || MENTIONS_ART22.test(q))
  );
}

/** 第22條第1項第9款是否可能適用於本案標的 */
export function art22Item9Applicable(query: string, category: ProcurementCategory | null): boolean {
  // 財物／工程明確排除
  if (category === "財物" || category === "工程") return false;
  if (/財物|財務/.test(query) && !ART22_9_SERVICES.test(query) && !/勞務/.test(query)) {
    return false;
  }
  if (/工程/.test(query) && !ART22_9_SERVICES.test(query) && !/勞務|資訊服務|專業服務|技術服務/.test(query)) {
    return false;
  }
  // 需有第9款服務標的或已認定為勞務
  if (ART22_9_SERVICES.test(query) || category === "勞務") return true;
  // 僅寫「公開評選限制性招標」但無服務標的 → 不逕認第9款適用
  return false;
}

export function detectOpeningMode(
  query: string,
  category: ProcurementCategory | null = inferProcurementCategory(query).category,
): OpeningMode {
  const claimsOpenSelection =
    OPEN_SELECTION_WORDS.test(query) ||
    (MENTIONS_ART22.test(query) && /公開評選|第\s*9\s*款|第九款/.test(query)) ||
    (/限制性招標/.test(query) && ART22_9_SERVICES.test(query));

  if (claimsOpenSelection || (OPEN_SELECTION_WORDS.test(query) && MENTIONS_ART22.test(query))) {
    if (!art22Item9Applicable(query, category)) {
      // 使用者主張公開評選／第9款，但標的為財物／工程 → 不相容
      if (category === "財物" || category === "工程" || GOODS_OR_WORKS.test(query)) {
        return "art22_9_inapplicable";
      }
    }
    if (art22Item9Applicable(query, category)) {
      return "open_selection_restricted";
    }
  }

  // 有服務標的＋限制性招標／公開評選用語
  if (
    art22Item9Applicable(query, category) &&
    (/限制性招標/.test(query) || /公開評選/.test(query))
  ) {
    return "open_selection_restricted";
  }

  if (SELECTIVE_LIST.test(query)) return "selective_qualified_list";
  if (SELECTIVE_CASE.test(query) && !PUBLIC_TENDER.test(query)) return "selective_case";
  if (PUBLIC_TENDER.test(query)) return "public_tender";
  return "unknown";
}

export function analyzeOpeningBidderCount(query: string): OpeningBidderAnalysis | null {
  if (
    !isOpeningBidderCountQuery(query) &&
    !(OPEN_SELECTION_WORDS.test(query) && /開標|幾家|家數|財物|財務|工程/.test(query))
  ) {
    return null;
  }

  const { category, reason } = inferProcurementCategory(query);
  const mode = detectOpeningMode(query, category);

  const lines: string[] = [
    "【系統開標家數判定導引｜請與檢索片段中採購法第22條、第48條、施行細則第55條對照】",
    "易混重點：",
    "1. 採購法第48條「三家以上合格廠商」＋施行細則第55條：該「三家」係指**公開招標**。",
    "2. 第22條第1項第9款公開評選限制性招標：僅適用「委託專業服務、技術服務、資訊服務或社會福利服務」，屬**勞務**；**不適用財物採購，亦不適用工程採購**。",
    "3. 不得因「公開評選」字樣，就把第9款家數規則套用到財物／工程案。",
  ];

  if (category) {
    lines.push(`本案採購類別（推論）：${category}${reason ? `（${reason}）` : ""}。`);
  }

  let minQualifiedVendors: number | null = null;
  let conclusion = "";

  switch (mode) {
    case "art22_9_inapplicable":
      minQualifiedVendors = null;
      conclusion =
        "採購法第22條第1項第9款不適用財物（或工程）採購，不得以該款之「公開評選限制性招標」主張第一次開標僅需1家。財物／工程若採公開招標，第一次開標原則仍須3家以上合格廠商（第48條）；若依第22條其他款採限制性招標，應敘明所依款次，家數依該程序辦理（比價／議價），而非逕用第9款規則。";
      lines.push(
        "本案模式判定：標的為財物／工程，與第22條第1項第9款適用範圍不符。",
        `建議結論：${conclusion}`,
        "回答時應先更正「第9款不適用財物／工程」，再依實際招標方式說明家數；勿輸出「依第9款第一次開標1家即可」。",
      );
      break;
    case "open_selection_restricted":
      minQualifiedVendors = 1;
      conclusion =
        "在標的確屬專業／技術／資訊／社福服務（勞務），並依採購法第22條第1項第9款採公開評選之限制性招標時，第一次開標至少需要 1 家合格廠商（無須 3 家）。";
      lines.push(
        "本案模式判定：第22條第1項第9款公開評選＋限制性招標（勞務服務類）。",
        "建議結論：第一次開標至少 1 家合格廠商即可；勿套用公開招標之三家規定。",
        "後續仍須依評選及計費辦法評選優勝廠商，再與優勝者議價。",
      );
      break;
    case "public_tender":
      minQualifiedVendors = 3;
      conclusion =
        "採公開招標時，第一次開標原則上應有 3 家以上合格廠商投標始得開標（採購法第48條）；第一次因未滿三家流標後，第二次得不受三家限制。";
      lines.push("本案模式判定：公開招標。", `建議結論：${conclusion}`);
      break;
    case "selective_qualified_list":
      minQualifiedVendors = 6;
      conclusion =
        "選擇性招標為建立合格廠商名單而辦理資格審查者，實務上常須達一定家數（常見為 6 家以上）始得審查；請以相關規定片段為準。";
      lines.push("本案模式判定：選擇性招標－建立合格廠商名單。", `建議結論：${conclusion}`);
      break;
    case "selective_case":
      minQualifiedVendors = 1;
      conclusion =
        "為特定個案辦理之選擇性招標資格標，實務上多無公開招標之三家限制；請對照片段確認。";
      lines.push("本案模式判定：個案選擇性招標。", `建議結論：${conclusion}`);
      break;
    default:
      conclusion =
        "請先釐清：(1) 標的為工程／財物／勞務；(2) 招標方式。第22條第1項第9款僅限特定勞務服務之公開評選；財物案不可套用該款「1家即可」規則。公開招標第一次則須3家。";
      lines.push(`建議結論：${conclusion}`);
  }

  return {
    mode,
    minQualifiedVendors,
    category,
    conclusion,
    guidance: lines.join("\n"),
  };
}

export function openingBidderExpansionTerms(query: string): string[] {
  const terms = ["開標", "合格廠商", "三家", "一家", "家數", "公開招標", "限制性招標", "公開評選", "第二十二條"];
  if (ART22_9_SERVICES.test(query) || /勞務/.test(query)) {
    terms.push("公開客觀評選", "專業服務", "技術服務", "資訊服務", "施行細則", "最有利標");
  }
  if (/財物|財務|工程/.test(query)) {
    terms.push("財物", "不適用", "公開招標", "第四十八條", "三家以上合格廠商投標");
  }
  if (PUBLIC_TENDER.test(query)) {
    terms.push("第四十八條", "流標", "第二次招標");
  }
  return [...new Set(terms)];
}
