/**
 * 模考／題庫 AI 診斷分段：個人化學習弱點診斷書欄位＋錯題原因
 */

export type DiagnosticSections = {
  /** 弱點分析（含補強指引）／關鍵弱點敘述 */
  weaknessAnalysis: string;
  /** 錯題原因分析（逐題） */
  wrongReasonAnalysis: string;
  /** 建議補強法規（原文區塊，可選） */
  regulationAdvice: string;
  /** 選擇錯誤選項的常見認知誤區（單題 LLM） */
  cognitiveMisconception: string;
  /** 正確／錯誤選項適用條件差異（單題 LLM，宜為 2 句） */
  applicabilityDiff: string;
  /** 核心強項（診斷書） */
  coreStrengths: string;
  /** 關鍵弱點（診斷書） */
  keyWeaknesses: string;
  /** 行動建議（診斷書） */
  actionAdvice: string;
};

const SECTION_ALIASES: Record<string, keyof DiagnosticSections> = {
  弱點分析: "weaknessAnalysis",
  弱點提示: "weaknessAnalysis",
  弱點補強指引: "weaknessAnalysis",
  綜合觀念診斷: "weaknessAnalysis",
  錯題原因分析: "wrongReasonAnalysis",
  逐題要點: "wrongReasonAnalysis",
  建議補強法規: "regulationAdvice",
  認知誤區: "cognitiveMisconception",
  適用條件差異: "applicabilityDiff",
  核心強項: "coreStrengths",
  關鍵弱點: "keyWeaknesses",
  行動建議: "actionAdvice",
};

/** 將 markdown ## 標題診斷文拆成診斷書欄位 */
export function parseDiagnosticSections(summary: string | null | undefined): DiagnosticSections {
  const empty: DiagnosticSections = {
    weaknessAnalysis: "",
    wrongReasonAnalysis: "",
    regulationAdvice: "",
    cognitiveMisconception: "",
    applicabilityDiff: "",
    coreStrengths: "",
    keyWeaknesses: "",
    actionAdvice: "",
  };
  if (!summary?.trim()) return empty;

  const lines = summary.replace(/\r\n/g, "\n").split("\n");
  const buckets: Record<keyof DiagnosticSections, string[]> = {
    weaknessAnalysis: [],
    wrongReasonAnalysis: [],
    regulationAdvice: [],
    cognitiveMisconception: [],
    applicabilityDiff: [],
    coreStrengths: [],
    keyWeaknesses: [],
    actionAdvice: [],
  };
  let current: keyof DiagnosticSections | null = null;

  for (const line of lines) {
    const m = line.trim().match(/^##\s*(.+?)\s*$/);
    if (m) {
      const title = m[1]!.replace(/[：:]\s*$/, "").trim();
      current = SECTION_ALIASES[title] ?? null;
      continue;
    }
    if (current) buckets[current].push(line);
  }

  return {
    weaknessAnalysis: buckets.weaknessAnalysis.join("\n").trim(),
    wrongReasonAnalysis: buckets.wrongReasonAnalysis.join("\n").trim(),
    regulationAdvice: buckets.regulationAdvice.join("\n").trim(),
    cognitiveMisconception: buckets.cognitiveMisconception.join("\n").trim(),
    applicabilityDiff: buckets.applicabilityDiff.join("\n").trim(),
    coreStrengths: buckets.coreStrengths.join("\n").trim(),
    keyWeaknesses: buckets.keyWeaknesses.join("\n").trim(),
    actionAdvice: buckets.actionAdvice.join("\n").trim(),
  };
}

/** 從錯題原因區塊擷取「第N題：…」註記 */
export function extractWrongReasonNotes(
  summary: string,
  wrongIndexes: number[],
): Map<number, string> {
  const map = new Map<number, string>();
  const sections = parseDiagnosticSections(summary);
  const block =
    sections.wrongReasonAnalysis ||
    summary.split(/##\s*逐題要點/)[1]?.split(/##\s*/)[0] ||
    "";
  for (const idx of wrongIndexes) {
    const re = new RegExp(
      `第\\s*${idx + 1}\\s*題[:：]\\s*([^\\n]+(?:\\n(?!第\\s*\\d+\\s*題)[^\\n]+)*)`,
      "m",
    );
    const m = block.match(re);
    if (m?.[1]) map.set(idx, m[1].trim());
  }
  return map;
}
