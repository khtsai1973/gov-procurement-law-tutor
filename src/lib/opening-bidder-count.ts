/**
 * 開標／投標合格廠商家數判定輔助。
 * 常見易混：公開招標第1次須3家 vs 第22條公開評選限制性招標無3家限制（1家即可）。
 */

export type OpeningMode =
  | "public_tender"
  | "open_selection_restricted" // 第22條第1項第9～11款等公開評選／公開徵求之限制性招標
  | "selective_qualified_list" // 建立合格廠商名單之選擇性招標資格審查
  | "selective_case" // 個案選擇性招標
  | "unknown";

export type OpeningBidderAnalysis = {
  mode: OpeningMode;
  minQualifiedVendors: number | null;
  /** 結論短句 */
  conclusion: string;
  guidance: string;
};

const OPEN_SELECTION =
  /公開評選|公開客觀評選|第\s*22\s*條|第二十二條|22\s*條\s*第\s*1\s*項\s*第\s*9|限制性招標.*公開|公開.*限制性招標|經公開評選/;

const PUBLIC_TENDER = /公開招標/;
const SELECTIVE_LIST = /選擇性招標.*合格廠商名單|建立合格廠商名單|經常性採購.*選擇性/;
const SELECTIVE_CASE = /選擇性招標|個案.*選擇性/;

const ASKS_BIDDER_COUNT =
  /幾家|家數|至少.*家|須有.*家|要有.*家|合格廠商|方可開標|始得開標|才能開標|開標.*家/;

export function isOpeningBidderCountQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return ASKS_BIDDER_COUNT.test(q) && (/開標|投標|招標|評選/.test(q) || OPEN_SELECTION.test(q));
}

export function detectOpeningMode(query: string): OpeningMode {
  if (OPEN_SELECTION.test(query) || (/限制性招標/.test(query) && /公開評選|資訊服務|專業服務|技術服務|社會福利/.test(query))) {
    return "open_selection_restricted";
  }
  if (SELECTIVE_LIST.test(query)) return "selective_qualified_list";
  if (SELECTIVE_CASE.test(query) && !PUBLIC_TENDER.test(query)) return "selective_case";
  if (PUBLIC_TENDER.test(query)) return "public_tender";
  return "unknown";
}

export function analyzeOpeningBidderCount(query: string): OpeningBidderAnalysis | null {
  if (!isOpeningBidderCountQuery(query) && !(OPEN_SELECTION.test(query) && /開標|幾家|家數/.test(query))) {
    return null;
  }

  const mode = detectOpeningMode(query);

  const lines: string[] = [
    "【系統開標家數判定導引｜請與檢索片段中採購法第48條、施行細則第55條及最有利標作業說明對照】",
    "易混重點：採購法第48條「三家以上合格廠商」主要適用於公開招標；施行細則第55條明定該「三家」係指辦理公開招標之情形。",
    "依採購法第22條第1項第9款（專業／技術／資訊／社福服務等）採公開評選之限制性招標，非公開招標，第一次開標無須滿三家，有一家合格廠商投標即得開標／續行評選程序。",
  ];

  let minQualifiedVendors: number | null = null;
  let conclusion = "";

  switch (mode) {
    case "open_selection_restricted":
      minQualifiedVendors = 1;
      conclusion =
        "採「公開評選之限制性招標」（如採購法第22條第1項第9款資訊服務）時，第一次開標至少需要 1 家合格廠商（無須 3 家）。";
      lines.push(
        "本案模式判定：公開評選＋限制性招標（資訊／專業／技術服務等常見於此）。",
        "建議結論：第一次開標至少 1 家合格廠商即可；勿套用公開招標之三家規定。",
        "後續仍須依評選及計費辦法評選優勝廠商，再與優勝者議價（訂有固定金額／費率者依招標文件辦理）。",
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
        "選擇性招標為建立合格廠商名單而辦理資格審查者，實務上常須達一定家數（常見為 6 家以上）始得審查；請以招標期限標準／相關規定片段為準。";
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
        "請先釐清招標方式為公開招標、選擇性招標或第22條公開評選之限制性招標，再適用對應家數規定。";
      lines.push(
        "本案招標方式未明確：若為「公開評選限制性招標／第22條第1項第9款」→ 1 家；若為「公開招標第一次」→ 3 家。",
      );
  }

  lines.push("回答時須引用片段中施行細則或作業手冊文字，並明確對照「不是／才是」公開招標三家規定。");

  return {
    mode,
    minQualifiedVendors,
    conclusion,
    guidance: lines.join("\n"),
  };
}

export function openingBidderExpansionTerms(query: string): string[] {
  const terms = ["開標", "合格廠商", "三家", "一家", "家數", "公開招標", "限制性招標", "公開評選"];
  if (OPEN_SELECTION.test(query) || /資訊服務|專業服務|技術服務/.test(query)) {
    terms.push("第二十二條", "公開客觀評選", "施行細則", "三家以上合格廠商投標", "最有利標");
  }
  if (PUBLIC_TENDER.test(query)) {
    terms.push("第四十八條", "流標", "第二次招標");
  }
  return [...new Set(terms)];
}
