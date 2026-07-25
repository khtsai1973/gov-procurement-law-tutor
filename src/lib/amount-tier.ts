/**
 * 採購金額級距判定輔助：自問題抽出金額／標的類型，對照工程會門檻彙整常數，
 * 供 RAG 強制檢索與 LLM 綜合推論（數字須與 corpus 門檻表一致）。
 */

export type ProcurementCategory = "工程" | "財物" | "勞務";

export type AmountTierKey =
  | "小額採購"
  | "未達公告金額（非小額）"
  | "達公告金額、未達查核金額"
  | "達查核金額、未達巨額"
  | "巨額採購";

/** 與 data/corpus/pcc-procurement-amount-thresholds.md 一致（新臺幣元） */
export const AMOUNT_THRESHOLDS = {
  工程: { announce: 1_500_000, audit: 50_000_000, mega: 200_000_000, small: 150_000 },
  財物: { announce: 1_500_000, audit: 50_000_000, mega: 100_000_000, small: 150_000 },
  勞務: { announce: 1_500_000, audit: 10_000_000, mega: 20_000_000, small: 150_000 },
} as const;

const SERVICE_AS_LABOR =
  /資訊服務|專業服務|技術服務|社會福利服務|研究發展|營運管理|顧問|系統整合|軟體開發|軟體維護/;

/** 是否為「給定金額／標的，問屬哪一級距」類問題 */
export function isAmountTierClassificationQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;

  const hasAmount =
    /\d+\s*萬|\d+\s*億|新臺幣|NT\$|[\d,]+元/.test(q) ||
    /[一二三四五六七八九十百千]+萬|[一二三四五六七八九十]+億/.test(q);

  const asksTier =
    /級距|金額門檻|屬(於)?哪|落在哪|算不算|是否達|達不達|未達|公告金額|查核金額|巨額|小額採購|哪一個.*採購/.test(
      q,
    );

  const hasCategoryCue =
    /工程|財物|勞務|資訊服務|專業服務|技術服務|社會福利/.test(q);

  return (hasAmount && asksTier) || (hasAmount && hasCategoryCue && /採購/.test(q));
}

export function parseAmountTwd(query: string): number | null {
  const q = query.replace(/,/g, "");

  const yi = q.match(/(\d+(?:\.\d+)?)\s*億/);
  if (yi) return Math.round(Number(yi[1]) * 100_000_000);

  const wan = q.match(/(\d+(?:\.\d+)?)\s*萬/);
  if (wan) return Math.round(Number(wan[1]) * 10_000);

  const ntd = q.match(/(?:新臺幣|NT\$)\s*(\d+)/i);
  if (ntd) return Number(ntd[1]);

  const yuan = q.match(/(\d{4,})\s*元/);
  if (yuan) return Number(yuan[1]);

  return null;
}

export function inferProcurementCategory(query: string): {
  category: ProcurementCategory | null;
  reason: string | null;
} {
  if (SERVICE_AS_LABOR.test(query) || /勞務/.test(query)) {
    const serviceHit = query.match(SERVICE_AS_LABOR)?.[0];
    return {
      category: "勞務",
      reason: serviceHit
        ? `問題提及「${serviceHit}」；依政府採購法，資訊／專業／技術等服務屬勞務採購`
        : "問題明示勞務採購",
    };
  }
  if (/工程/.test(query) && !/財物|財務|勞務/.test(query)) {
    return { category: "工程", reason: "問題明示工程採購" };
  }
  if (/財物|財務/.test(query) && !/工程|勞務/.test(query) && !SERVICE_AS_LABOR.test(query)) {
    return {
      category: "財物",
      reason: /財務/.test(query)
        ? "問題提及「財務」，教學上常為「財物」之誤寫／同指財物採購"
        : "問題明示財物採購",
    };
  }
  // 同時列出工程財物勞務作選項時，若有服務關鍵詞已在上方處理
  if (/工程/.test(query) && /財物|財務/.test(query) && /勞務/.test(query)) {
    return { category: null, reason: "問題同時列舉工程／財物／勞務，需先依標的認定類別" };
  }
  return { category: null, reason: null };
}

export function classifyAmountTier(
  amount: number,
  category: ProcurementCategory,
): AmountTierKey {
  const t = AMOUNT_THRESHOLDS[category];
  if (amount >= t.mega) return "巨額採購";
  if (amount >= t.audit) return "達查核金額、未達巨額";
  if (amount >= t.announce) return "達公告金額、未達查核金額";
  if (amount <= t.small) return "小額採購";
  return "未達公告金額（非小額）";
}

function formatTwd(n: number): string {
  if (n >= 100_000_000 && n % 100_000_000 === 0) return `${n / 100_000_000} 億元`;
  if (n >= 10_000 && n % 10_000 === 0) return `${n / 10_000} 萬元`;
  return `${n.toLocaleString("zh-TW")} 元`;
}

export type AmountTierAnalysis = {
  amount: number | null;
  category: ProcurementCategory | null;
  categoryReason: string | null;
  tier: AmountTierKey | null;
  /** 注入 LLM／檢索的結構化導引（非杜撰門檻，與 corpus 常數對齊） */
  guidance: string;
};

/** 自使用者問題建立級距判定導引；無法判定時仍給出步驟說明 */
export function analyzeAmountTierQuestion(query: string): AmountTierAnalysis | null {
  if (!isAmountTierClassificationQuery(query) && !isLooseAmountTierQuery(query)) {
    return null;
  }

  const amount = parseAmountTwd(query);
  const { category, reason } = inferProcurementCategory(query);
  const tier =
    amount != null && category != null ? classifyAmountTier(amount, category) : null;

  const lines: string[] = [
    "【系統級距判定導引｜請與檢索片段中之工程會門檻表、採購法第七條對照後作答】",
    "判定步驟：",
    "1. 先認定採購類別（工程／財物／勞務）。資訊服務、專業服務、技術服務等屬勞務（採購法第七條）。",
    "2. 再將本案採購金額與該類別之小額／公告金額／查核金額／巨額門檻比較。",
    "3. 結論應寫明：類別＋級距名稱（例如：達公告金額、未達查核金額之勞務採購），並引用片段門檻數字。",
  ];

  if (amount != null) {
    lines.push(`使用者金額（解析）：新臺幣 ${formatTwd(amount)}（${amount} 元）。`);
  } else {
    lines.push("使用者金額：未能自問題解析確定數字，請依問題原文金額對照片段門檻。");
  }

  if (category) {
    lines.push(`採購類別（推論）：${category}。${reason ? `（${reason}）` : ""}`);
    const t = AMOUNT_THRESHOLDS[category];
    lines.push(
      `${category}門檻對照（與知識庫工程會門檻彙整一致）：小額 ${formatTwd(t.small)} 以下；公告金額 ${formatTwd(t.announce)}；查核金額 ${formatTwd(t.audit)}；巨額 ${formatTwd(t.mega)}。`,
    );
  } else {
    lines.push(
      `採購類別：${reason ?? "問題未明示；若為資訊服務應先歸勞務，再分別說明三類門檻差異"}。`,
    );
  }

  if (tier && category && amount != null) {
    lines.push(
      `建議結論（須以片段印證）：本案屬「${tier}」之「${category}」採購（金額 ${formatTwd(amount)}）。`,
    );
  }

  lines.push("注意：門檻數字必須來自檢索片段或上表（與片段一致時）；勿另造數字。提醒以工程會最新公告為準。");

  return {
    amount,
    category,
    categoryReason: reason,
    tier,
    guidance: lines.join("\n"),
  };
}

function isLooseAmountTierQuery(query: string): boolean {
  return (
    /金額級距|採購金額級距|屬(於)?哪.*級距|哪一個.*級距/.test(query) ||
    (/\d+\s*萬/.test(query) && /採購/.test(query) && /級距|公告|查核|巨額|小額/.test(query))
  );
}

/** 供 RAG 查詢擴展的額外關鍵詞 */
export function amountTierExpansionTerms(query: string): string[] {
  const terms = ["公告金額", "查核金額", "巨額", "小額採購", "金額門檻", "金額級距", "採購金額"];
  if (SERVICE_AS_LABOR.test(query)) {
    terms.push("勞務", "資訊服務", "第七條", "採購法第七條");
  }
  if (/工程/.test(query)) terms.push("工程");
  if (/財物/.test(query)) terms.push("財物");
  if (/勞務/.test(query)) terms.push("勞務");
  return [...new Set(terms)];
}
