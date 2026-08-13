/**
 * 引導式 Prompt：情境選單＋動態欄位填寫（Dynamic Slot-Filling）
 * 點擊情境 → 輕量表單 → 組裝高質量結構化 Prompt。
 */

export type GuidedSlotOption = { value: string; label: string };

export type GuidedSlotField = {
  key: string;
  label: string;
  /** select：選項；amount：金額（萬元）；text：短文字 */
  type: "select" | "amount" | "text";
  options?: GuidedSlotOption[];
  required?: boolean;
  placeholder?: string;
  /** 預設值 */
  defaultValue?: string;
};

export type GuidedScenario = {
  id: string;
  /** 選單標題 */
  title: string;
  /** 一句話說明 */
  description: string;
  /** 動態欄位（點擊情境後彈出） */
  slots: GuidedSlotField[];
  /**
   * 靜態填空模板（相容舊行為／備援）。
   * 正式流程以 assembleGuidedPrompt 產出。
   */
  template: string;
  /** 可一鍵帶入「想請教」欄的完整提問範例 */
  starters: string[];
};

const SUBJECT_OPTIONS: GuidedSlotOption[] = [
  { value: "工程", label: "工程" },
  { value: "財物", label: "財物" },
  { value: "勞務", label: "勞務" },
  { value: "資訊服務（屬勞務）", label: "資訊服務（屬勞務）" },
  { value: "專業／技術／社福服務（屬勞務）", label: "專業／技術／社福服務（屬勞務）" },
];

const AMOUNT_TIER_OPTIONS: GuidedSlotOption[] = [
  { value: "未達公告金額（含小額）", label: "未達公告金額（含小額）" },
  { value: "達公告金額、未達查核金額", label: "達公告、未達查核" },
  { value: "達查核金額、未達巨額", label: "達查核、未達巨額" },
  { value: "巨額採購", label: "巨額採購" },
  { value: "尚不清楚", label: "尚不清楚" },
];

const YES_NO: GuidedSlotOption[] = [
  { value: "是", label: "是" },
  { value: "否", label: "否" },
  { value: "不清楚", label: "不清楚" },
];

const BID_METHOD_OPTIONS: GuidedSlotOption[] = [
  { value: "公開招標", label: "公開招標" },
  { value: "選擇性招標", label: "選擇性招標" },
  { value: "限制性招標", label: "限制性招標" },
  { value: "公開取得報價單或企劃書", label: "公開取得報價單或企劃書" },
  { value: "尚未決定", label: "尚未決定" },
];

const AWARD_OPTIONS: GuidedSlotOption[] = [
  { value: "最低標", label: "最低標" },
  { value: "最有利標", label: "最有利標" },
  { value: "複數決標", label: "複數決標" },
  { value: "尚未決定", label: "尚未決定" },
];

export const GUIDED_SCENARIOS: GuidedScenario[] = [
  {
    id: "award-method",
    title: "決標方式判斷",
    description: "最低標、最有利標、複數決標該怎麼選？",
    slots: [
      { key: "subject", label: "採購標的", type: "select", options: SUBJECT_OPTIONS, required: true },
      {
        key: "amountWan",
        label: "採購金額（萬元）",
        type: "amount",
        required: true,
        placeholder: "例：250",
      },
      { key: "taxIncluded", label: "是否含稅", type: "select", options: YES_NO, defaultValue: "是" },
      {
        key: "awardPrinciple",
        label: "目前傾向決標原則",
        type: "select",
        options: AWARD_OPTIONS,
        required: true,
        defaultValue: "尚未決定",
      },
      {
        key: "specialService",
        label: "是否屬專業／技術／資訊／社福／文創服務",
        type: "select",
        options: YES_NO,
        defaultValue: "不清楚",
      },
    ],
    template: `【決標方式判斷】
採購標的：（工程／財物／勞務；若為資訊服務請註明）
採購金額：（     ）元（是否含稅：是／否）
目前傾向決標原則：（最低標／最有利標／複數決標／尚未決定）
是否屬專業／技術／資訊／社福／文創服務：（是／否）

想請教：`,
    starters: [
      "最有利標和最低標有什麼不同？什麼情況下應採最有利標？",
      "公告金額以上的資訊服務採購，決標原則有何特別規定？",
      "100萬元以上的採購應依最低標原則辦理。這樣說對嗎？",
      "採最有利標決標是否須報上級機關核准？",
    ],
  },
  {
    id: "bidding-docs",
    title: "招標文件疑義處理",
    description: "招標方式、等標期、廠商家數與文件疑義",
    slots: [
      { key: "subject", label: "採購標的", type: "select", options: SUBJECT_OPTIONS, required: true },
      {
        key: "amountWan",
        label: "採購金額（萬元）",
        type: "amount",
        required: true,
        placeholder: "例：180",
      },
      {
        key: "bidMethod",
        label: "招標方式",
        type: "select",
        options: BID_METHOD_OPTIONS,
        required: true,
      },
      {
        key: "issueFocus",
        label: "疑義重點",
        type: "select",
        required: true,
        options: [
          { value: "等標期", label: "等標期" },
          { value: "廠商資格", label: "廠商資格" },
          { value: "技術規格", label: "技術規格" },
          { value: "開標家數", label: "開標家數" },
          { value: "閱覽招標文件", label: "閱覽招標文件" },
          { value: "其他", label: "其他" },
        ],
      },
    ],
    template: `【招標文件疑義】
採購標的：（工程／財物／勞務）
採購金額：（     ）元
招標方式：（公開招標／選擇性招標／限制性招標／公開取得報價單／其他）
疑義重點：（等標期、資格、技術規格、開標家數、閱覽招標文件等）

想請教：`,
    starters: [
      "公告金額以上採購是否一定要公開招標？",
      "公開招標第一次開標，至少需要幾家合格廠商？",
      "第22條第1項第9款公開評選限制性招標，是否適用財物採購？",
      "公開招標等標期，公告金額以上未達查核金額至少幾日？",
    ],
  },
  {
    id: "performance-dispute",
    title: "履約爭議申訴",
    description: "驗收、改善、減價收受與爭議程序",
    slots: [
      {
        key: "subject",
        label: "契約類型",
        type: "select",
        options: [
          { value: "工程", label: "工程" },
          { value: "財物", label: "財物" },
          { value: "勞務", label: "勞務" },
        ],
        required: true,
      },
      {
        key: "stage",
        label: "履約階段",
        type: "select",
        required: true,
        options: [
          { value: "履約中", label: "履約中" },
          { value: "驗收", label: "驗收" },
          { value: "保固", label: "保固" },
        ],
      },
      {
        key: "dispute",
        label: "爭點",
        type: "select",
        required: true,
        options: [
          { value: "逾期", label: "逾期" },
          { value: "驗收不符", label: "驗收不符" },
          { value: "改善重作", label: "改善重作" },
          { value: "減價收受", label: "減價收受" },
          { value: "契約變更", label: "契約變更" },
          { value: "違約金", label: "違約金" },
          { value: "異議／申訴", label: "異議／申訴" },
        ],
      },
      {
        key: "amountTier",
        label: "採購金額級距",
        type: "select",
        options: AMOUNT_TIER_OPTIONS,
        required: true,
        defaultValue: "尚不清楚",
      },
    ],
    template: `【履約／驗收／爭議】
契約類型：（工程／財物／勞務）
履約階段：（履約中／驗收／保固）
爭點：（逾期、驗收不符、改善重作、減價收受、契約變更、違約金、申訴異議等）
採購金額級距：（未達公告／公告以上／查核以上／不清楚）

想請教：`,
    starters: [
      "驗收結果與契約規定不符時，機關可以怎麼處理？",
      "機關辦理工程、財物採購之驗收，承辦採購人員可否擔任主驗人？",
      "公告金額以上採購之開標、決標及驗收，監辦規定為何？",
      "未達公告金額之採購，何時應通知派員監辦？",
    ],
  },
  {
    id: "amount-tier",
    title: "金額門檻／級距",
    description: "小額、公告、查核、巨額怎麼判",
    slots: [
      { key: "subject", label: "採購標的", type: "select", options: SUBJECT_OPTIONS, required: true },
      {
        key: "amountWan",
        label: "預算或估計金額（萬元）",
        type: "amount",
        required: true,
        placeholder: "例：250",
      },
      {
        key: "includeFollowOn",
        label: "是否含後續擴充或選購",
        type: "select",
        options: YES_NO,
        defaultValue: "否",
      },
    ],
    template: `【金額門檻情境】
採購標的：（工程／財物／勞務；若為資訊服務請填資訊服務）
預算或估計採購金額：（     ）元（例：250萬元）
是否含後續擴充或選購：（是／否）
想確認：屬於哪一個採購金額級距（小額／未達公告／達公告未達查核／達查核未達巨額／巨額）

想請教：`,
    starters: [
      "今年的查核金額、公告金額各是多少？",
      "中央機關小額採購金額門檻是多少？",
      "新臺幣250萬元的資訊服務採購，屬哪一級距？",
      "採購金額如何認定？是否含稅、後續擴充或選購？",
    ],
  },
  {
    id: "restricted-tender",
    title: "限制性招標／第22條",
    description: "可否不經公開招標？第9款範圍與家數",
    slots: [
      { key: "subject", label: "採購標的", type: "select", options: SUBJECT_OPTIONS, required: true },
      {
        key: "amountWan",
        label: "採購金額（萬元）",
        type: "amount",
        required: true,
        placeholder: "例：200",
      },
      {
        key: "article22",
        label: "擬援引條款",
        type: "select",
        required: true,
        options: [
          { value: "第22條第1項第2款（相容性／原廠）", label: "第2款（相容性／原廠）" },
          { value: "第22條第1項第6款（追加契約外工程）", label: "第6款（追加契約外）" },
          { value: "第22條第1項第7款", label: "第7款" },
          { value: "第22條第1項第9款（公開評選）", label: "第9款（公開評選）" },
          { value: "尚不確定", label: "尚不確定" },
        ],
        defaultValue: "尚不確定",
      },
      {
        key: "procedureIdea",
        label: "程序想法",
        type: "select",
        options: [
          { value: "公開評選", label: "公開評選" },
          { value: "向原廠採購", label: "向原廠採購" },
          { value: "緊急事故", label: "緊急事故" },
          { value: "其他／尚無", label: "其他／尚無" },
        ],
        defaultValue: "其他／尚無",
      },
    ],
    template: `【限制性招標判斷】
採購標的：（工程／財物／勞務／資訊服務等）
採購金額：（     ）元
擬援引條款：（第22條第1項第__款／尚不確定）
程序想法：（公開評選、向原廠採購、緊急事故等）

想請教：`,
    starters: [
      "因相容性必須向原廠採購後續維修零配件，可能依哪一款採限制性招標？",
      "依第22條第1項第9款辦理公開評選，第一次開標是否也要三家？",
      "追加契約外工程得依第22條第1項第6款限制性招標的金額上限是什麼？",
    ],
  },
  {
    id: "bidding-general",
    title: "招標程序一般",
    description: "公開／選擇性／限制性招標與統包",
    slots: [
      { key: "subject", label: "採購標的", type: "select", options: SUBJECT_OPTIONS, required: true },
      {
        key: "amountWan",
        label: "採購金額（萬元）",
        type: "amount",
        required: true,
        placeholder: "例：150",
      },
      { key: "taxIncluded", label: "是否含稅", type: "select", options: YES_NO, defaultValue: "是" },
      {
        key: "bidMethod",
        label: "招標方式",
        type: "select",
        options: BID_METHOD_OPTIONS,
        required: true,
      },
      {
        key: "phase",
        label: "程序階段",
        type: "select",
        options: [
          { value: "招標文件製作", label: "招標文件製作" },
          { value: "公告", label: "公告" },
          { value: "等標期", label: "等標期" },
          { value: "開標評標", label: "開標評標" },
        ],
        required: true,
      },
    ],
    template: `【招標情境】
採購標的：（工程／財物／勞務）
採購金額：（     ）元（是否含稅：是／否）
招標方式：（公開招標／公開取得報價單／限制性招標／其他）
程序階段：（招標文件製作／公告／等標期／開標評標）

想請教：`,
    starters: [
      "採購之招標方式分為哪三種？各自定義為何？",
      "什麼情況下公告金額以上採購得採選擇性招標？",
      "機關得否以統包方式辦理招標？統包所指為何？",
    ],
  },
];

export const GUIDED_INTRO =
  "不知道怎麼問？先選一個情境，填寫標的與金額等欄位後自動組裝結構化提問，再送出即可。";

export function getGuidedScenario(id: string | null | undefined): GuidedScenario | undefined {
  if (!id) return undefined;
  return GUIDED_SCENARIOS.find((s) => s.id === id);
}

/** 相容舊 SCENARIO_TEMPLATES 介面 */
export function guidedAsScenarioTemplates(): Array<{ id: string; label: string; body: string }> {
  return GUIDED_SCENARIOS.map((s) => ({
    id: s.id,
    label: s.title,
    body: s.template,
  }));
}

/** 欄位預設值 */
export function defaultSlotValues(scenario: GuidedScenario): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of scenario.slots) {
    out[slot.key] = slot.defaultValue ?? "";
  }
  return out;
}

/** 檢查必填欄位 */
export function validateSlotValues(
  scenario: GuidedScenario,
  values: Record<string, string>,
): string | null {
  for (const slot of scenario.slots) {
    if (!slot.required) continue;
    const v = (values[slot.key] ?? "").trim();
    if (!v) return `請填寫「${slot.label}」`;
    if (slot.type === "amount" && !/^\d+(\.\d+)?$/.test(v)) {
      return `「${slot.label}」請輸入數字（萬元）`;
    }
  }
  return null;
}

function formatAmountLine(amountWan: string | undefined, taxIncluded?: string): string {
  const wan = (amountWan ?? "").trim();
  if (!wan) return "（未填）";
  const n = Number(wan);
  if (!Number.isFinite(n)) return `${wan}萬元`;
  const yuan = Math.round(n * 10_000);
  const tax =
    taxIncluded && taxIncluded !== "不清楚" ? `（是否含稅：${taxIncluded}）` : "";
  return `新臺幣 ${yuan.toLocaleString("zh-TW")} 元（約 ${wan} 萬元）${tax}`;
}

/**
 * 依情境欄位組裝高質量結構化 Prompt。
 * `ask` 為「想請教」自由提問（可來自 starter 或手動輸入）。
 */
export function assembleGuidedPrompt(params: {
  scenario: GuidedScenario;
  values: Record<string, string>;
  ask: string;
}): string {
  const { scenario, values, ask } = params;
  const v = (key: string) => (values[key] ?? "").trim() || "（未填）";
  const lines: string[] = [`【${scenario.title}｜結構化案情】`];

  switch (scenario.id) {
    case "award-method":
      lines.push(
        `採購標的：${v("subject")}`,
        `採購金額：${formatAmountLine(values.amountWan, values.taxIncluded)}`,
        `目前傾向決標原則：${v("awardPrinciple")}`,
        `是否屬專業／技術／資訊／社福／文創服務：${v("specialService")}`,
      );
      break;
    case "bidding-docs":
      lines.push(
        `採購標的：${v("subject")}`,
        `採購金額：${formatAmountLine(values.amountWan)}`,
        `招標方式：${v("bidMethod")}`,
        `疑義重點：${v("issueFocus")}`,
      );
      break;
    case "performance-dispute":
      lines.push(
        `契約類型：${v("subject")}`,
        `履約階段：${v("stage")}`,
        `爭點：${v("dispute")}`,
        `採購金額級距：${v("amountTier")}`,
      );
      break;
    case "amount-tier":
      lines.push(
        `採購標的：${v("subject")}`,
        `預算或估計採購金額：${formatAmountLine(values.amountWan)}`,
        `是否含後續擴充或選購：${v("includeFollowOn")}`,
        `想確認：屬於哪一個採購金額級距（小額／未達公告／達公告未達查核／達查核未達巨額／巨額）`,
      );
      break;
    case "restricted-tender":
      lines.push(
        `採購標的：${v("subject")}`,
        `採購金額：${formatAmountLine(values.amountWan)}`,
        `擬援引條款：${v("article22")}`,
        `程序想法：${v("procedureIdea")}`,
      );
      break;
    case "bidding-general":
      lines.push(
        `採購標的：${v("subject")}`,
        `採購金額：${formatAmountLine(values.amountWan, values.taxIncluded)}`,
        `招標方式：${v("bidMethod")}`,
        `程序階段：${v("phase")}`,
      );
      break;
    default:
      for (const slot of scenario.slots) {
        if (slot.type === "amount") {
          lines.push(`${slot.label}：${formatAmountLine(values[slot.key])}`);
        } else {
          lines.push(`${slot.label}：${v(slot.key)}`);
        }
      }
  }

  lines.push("", "想請教：");
  const askText = ask.trim();
  if (askText) lines.push(askText);

  return lines.join("\n");
}
