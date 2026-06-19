/** 可從全國法規資料庫 API 下載之法規（pcode 見 sourceUrl） */
export type MojLawSource = {
  slug: string;
  title: string;
  pcode: string;
  /** law=法律；order=命令（含辦法、細則、規則等） */
  docType: "law" | "order";
};

export const MOJ_LAW_SOURCES: MojLawSource[] = [
  { slug: "government-procurement-act", title: "政府採購法", pcode: "A0030057", docType: "law" },
  { slug: "resource-recycling-act", title: "資源回收再利用法", pcode: "O0050028", docType: "law" },
  { slug: "gpa-enforcement-rules", title: "政府採購法施行細則", pcode: "A0030058", docType: "order" },
  {
    slug: "engineering-price-database-rules",
    title: "工程價格資料庫作業辦法",
    pcode: "D0070192",
    docType: "order",
  },
  {
    slug: "below-threshold-bidding-rules",
    title: "中央機關未達公告金額採購招標辦法",
    pcode: "A0030067",
    docType: "order",
  },
  {
    slug: "below-threshold-supervision-rules",
    title: "中央機關未達公告金額採購監辦辦法",
    pcode: "A0030066",
    docType: "order",
  },
  {
    slug: "bidding-deadline-standards",
    title: "招標期限標準",
    pcode: "A0030093",
    docType: "order",
  },
  {
    slug: "joint-procurement-supervision-rules",
    title: "機關主會計及有關單位會同監辦採購辦法",
    pcode: "A0030083",
    docType: "order",
  },
  {
    slug: "vendor-qualification-standards",
    title: "投標廠商資格與特殊或巨額採購認定標準",
    pcode: "A0030099",
    docType: "order",
  },
  { slug: "procurement-appeal-rules", title: "採購申訴審議規則", pcode: "A0030063", docType: "order" },
  {
    slug: "procurement-mediation-guidelines",
    title: "採購履約調解準則",
    pcode: "A0030064",
    docType: "order",
  },
  {
    slug: "green-preference-rules",
    title: "機關優先採購環境保護產品辦法",
    pcode: "A0030084",
    docType: "order",
  },
  {
    slug: "bid-bond-guarantee-operations-rules",
    title: "押標金保證金暨其他擔保作業辦法",
    pcode: "A0030079",
    docType: "order",
  },
  {
    slug: "professional-service-selection-billing-rules",
    title: "機關委託專業服務廠商評選及計費辦法",
    pcode: "A0030076",
    docType: "order",
  },
  {
    slug: "designated-area-real-estate-procurement-rules",
    title: "機關指定地區採購房地產作業辦法",
    pcode: "A0030074",
    docType: "order",
  },
  {
    slug: "design-competition-selection-billing-rules",
    title: "機關辦理設計競賽廠商評選及計費辦法",
    pcode: "A0030073",
    docType: "order",
  },
  {
    slug: "social-welfare-service-selection-billing-rules",
    title: "機關委託社會福利服務廠商評選及計費辦法",
    pcode: "A0030316",
    docType: "order",
  },
  {
    slug: "rd-commission-operations-rules",
    title: "機關委託研究發展作業辦法",
    pcode: "A0030106",
    docType: "order",
  },
  {
    slug: "foreign-vendor-non-treaty-procurement-rules",
    title: "外國廠商參與非條約協定採購處理辦法",
    pcode: "A0030072",
    docType: "order",
  },
  {
    slug: "national-security-vendor-qualification-rules",
    title: "機關辦理涉及國家安全採購之廠商資格限制條件及審查作業辦法",
    pcode: "A0030314",
    docType: "order",
  },
  {
    slug: "procurement-work-review-team-rules",
    title: "機關採購工作及審查小組設置及作業辦法",
    pcode: "A0030315",
    docType: "order",
  },
  {
    slug: "technical-service-selection-billing-rules",
    title: "機關委託技術服務廠商評選及計費辦法",
    pcode: "A0030077",
    docType: "order",
  },
  {
    slug: "it-service-selection-billing-rules",
    title: "機關委託資訊服務廠商評選及計費辦法",
    pcode: "A0030078",
    docType: "order",
  },
  {
    slug: "procurement-notice-gazette-rules",
    title: "政府採購公告及公報發行辦法",
    pcode: "A0030065",
    docType: "order",
  },
  {
    slug: "alternative-proposal-implementation-rules",
    title: "替代方案實施辦法",
    pcode: "A0030075",
    docType: "order",
  },
  {
    slug: "domestic-vendor-price-preference-rules",
    title: "國內廠商標價優惠實施辦法",
    pcode: "A0030082",
    docType: "order",
  },
  {
    slug: "cultural-arts-services-operations-rules",
    title: "機關邀請或委託文化藝術專業人士機構團體提供藝文服務作業辦法",
    pcode: "A0030104",
    docType: "order",
  },
  {
    slug: "most-advantageous-tender-selection-rules",
    title: "最有利標評選辦法",
    pcode: "A0030080",
    docType: "order",
  },
  {
    slug: "procurement-evaluation-committee-organization-rules",
    title: "採購評選委員會組織準則",
    pcode: "A0030103",
    docType: "order",
  },
];

export const MOJ_API = {
  law: "https://law.moj.gov.tw/api/ch/law/json",
  order: "https://law.moj.gov.tw/api/ch/order/json",
} as const;
