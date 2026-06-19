/**
 * 法規清單與 metadata（最後修正日可日後以爬蟲或手動更新）。
 * tier 對應：LAW < REGULATION < ADMIN_RULE < INTERPRETATION（位階由高到低）
 */
import { PrismaClient, RegulationTier } from "@prisma/client";

import { ingestCorpus } from "../src/lib/ingest";
import { importQuestionBank } from "../src/lib/import-question-bank";
import { clearQuestionBankCache } from "../src/lib/question-bank";

const prisma = new PrismaClient();

const REGULATIONS: Array<{
  slug: string;
  title: string;
  tier: RegulationTier;
  sortOrder: number;
  lastModifiedAt: Date;
  sourceUrl: string;
  notes?: string;
}> = [
  {
    slug: "government-procurement-act",
    title: "政府採購法",
    tier: RegulationTier.LAW,
    sortOrder: 0,
    lastModifiedAt: new Date("2023-05-30"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030057",
  },
  {
    slug: "resource-recycling-act",
    title: "資源回收再利用法",
    tier: RegulationTier.LAW,
    sortOrder: 1,
    lastModifiedAt: new Date("2024-05-29"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=O0050028",
  },
  {
    slug: "gpa-enforcement-rules",
    title: "政府採購法施行細則",
    tier: RegulationTier.REGULATION,
    sortOrder: 0,
    lastModifiedAt: new Date("2021-07-14"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030058",
  },
  {
    slug: "engineering-price-database-rules",
    title: "工程價格資料庫作業辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 22,
    lastModifiedAt: new Date("2015-11-03"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070192",
  },
  {
    slug: "below-threshold-bidding-rules",
    title: "中央機關未達公告金額採購招標辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 1,
    lastModifiedAt: new Date("2018-03-08"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030067",
  },
  {
    slug: "below-threshold-supervision-rules",
    title: "中央機關未達公告金額採購監辦辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 2,
    lastModifiedAt: new Date("2023-09-06"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030066",
  },
  {
    slug: "bidding-deadline-standards",
    title: "招標期限標準",
    tier: RegulationTier.REGULATION,
    sortOrder: 25,
    lastModifiedAt: new Date("2009-08-31"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030093",
  },
  {
    slug: "joint-procurement-supervision-rules",
    title: "機關主會計及有關單位會同監辦採購辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 3,
    lastModifiedAt: new Date("2010-11-29"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030083",
  },
  {
    slug: "vendor-qualification-standards",
    title: "投標廠商資格與特殊或巨額採購認定標準",
    tier: RegulationTier.REGULATION,
    sortOrder: 4,
    lastModifiedAt: new Date("2015-10-29"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030099",
  },
  {
    slug: "procurement-appeal-rules",
    title: "採購申訴審議規則",
    tier: RegulationTier.REGULATION,
    sortOrder: 5,
    lastModifiedAt: new Date("2018-12-28"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030063",
  },
  {
    slug: "procurement-mediation-guidelines",
    title: "採購履約調解準則",
    tier: RegulationTier.REGULATION,
    sortOrder: 6,
    lastModifiedAt: new Date("2021-07-01"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030064",
  },
  {
    slug: "green-preference-rules",
    title: "機關優先採購環境保護產品辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 7,
    lastModifiedAt: new Date("2001-01-15"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030084",
  },
  {
    slug: "bid-bond-guarantee-operations-rules",
    title: "押標金保證金暨其他擔保作業辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 8,
    lastModifiedAt: new Date("2019-11-18"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030079",
  },
  {
    slug: "designated-area-real-estate-procurement-rules",
    title: "機關指定地區採購房地產作業辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 9,
    lastModifiedAt: new Date("2025-11-20"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030074",
  },
  {
    slug: "design-competition-selection-billing-rules",
    title: "機關辦理設計競賽廠商評選及計費辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 10,
    lastModifiedAt: new Date("2025-05-23"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030073",
  },
  {
    slug: "professional-service-selection-billing-rules",
    title: "機關委託專業服務廠商評選及計費辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 11,
    lastModifiedAt: new Date("2025-05-23"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030076",
  },
  {
    slug: "social-welfare-service-selection-billing-rules",
    title: "機關委託社會福利服務廠商評選及計費辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 12,
    lastModifiedAt: new Date("2019-11-22"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030316",
  },
  {
    slug: "cultural-arts-services-operations-rules",
    title: "機關邀請或委託文化藝術專業人士機構團體提供藝文服務作業辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 13,
    lastModifiedAt: new Date("2021-09-11"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030104",
  },
  {
    slug: "procurement-work-review-team-rules",
    title: "機關採購工作及審查小組設置及作業辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 14,
    lastModifiedAt: new Date("2025-04-28"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030315",
  },
  {
    slug: "procurement-notice-gazette-rules",
    title: "政府採購公告及公報發行辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 15,
    lastModifiedAt: new Date("2008-05-20"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030065",
  },
  {
    slug: "alternative-proposal-implementation-rules",
    title: "替代方案實施辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 16,
    lastModifiedAt: new Date("2002-06-19"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030075",
  },
  {
    slug: "domestic-vendor-price-preference-rules",
    title: "國內廠商標價優惠實施辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 17,
    lastModifiedAt: new Date("1999-05-24"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030082",
  },
  {
    slug: "national-security-vendor-qualification-rules",
    title: "機關辦理涉及國家安全採購之廠商資格限制條件及審查作業辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 18,
    lastModifiedAt: new Date("2019-11-20"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030314",
  },
  {
    slug: "foreign-vendor-non-treaty-procurement-rules",
    title: "外國廠商參與非條約協定採購處理辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 19,
    lastModifiedAt: new Date("2012-08-14"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030072",
  },
  {
    slug: "rd-commission-operations-rules",
    title: "機關委託研究發展作業辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 20,
    lastModifiedAt: new Date("2016-02-17"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030106",
  },
  {
    slug: "technical-service-selection-billing-rules",
    title: "機關委託技術服務廠商評選及計費辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 21,
    lastModifiedAt: new Date("2025-05-23"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030077",
  },
  {
    slug: "it-service-selection-billing-rules",
    title: "機關委託資訊服務廠商評選及計費辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 23,
    lastModifiedAt: new Date("2025-05-23"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030078",
  },
  {
    slug: "most-advantageous-tender-selection-rules",
    title: "最有利標評選辦法",
    tier: RegulationTier.REGULATION,
    sortOrder: 24,
    lastModifiedAt: new Date("2025-01-21"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030080",
    notes:
      "依政府採購法第56條訂定之通用評選辦法；與專業／技術／資訊服務等「評選及計費辦法」不同。",
  },
  {
    slug: "procurement-evaluation-committee-organization-rules",
    title: "採購評選委員會組織準則",
    tier: RegulationTier.REGULATION,
    sortOrder: 26,
    lastModifiedAt: new Date("2026-05-08"),
    sourceUrl: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=A0030103",
    notes: "依政府採購法第94條第3項；115年5月8日修正第5條（工程企字第1150100205號）。",
  },
  {
    slug: "common-supply-contract-points",
    title: "中央機關共同供應契約集中採購實施要點",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 0,
    lastModifiedAt: new Date("2024-07-15"),
    sourceUrl: "https://www.pcc.gov.tw/temp/PCC_OP_List.aspx",
    notes: "工程會函釋／要點頁面請以工程會公告為準，此處為入口示意 URL。",
  },
  {
    slug: "public-works-public-inspection-points",
    title: "公共工程招標文件公開閱覽制度實施要點",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 1,
    lastModifiedAt: new Date("2020-01-01"),
    sourceUrl: "https://www.pcc.gov.tw/",
  },
  {
    slug: "procurement-contract-essentials",
    title: "採購契約要項",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 2,
    lastModifiedAt: new Date("2023-01-01"),
    sourceUrl: "https://www.pcc.gov.tw/",
  },
  {
    slug: "procurement-error-patterns",
    title: "各類型採購錯誤行為態樣",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 3,
    lastModifiedAt: new Date("2023-01-01"),
    sourceUrl: "https://www.pcc.gov.tw/",
  },
  {
    slug: "mep-combined-separate-bidding",
    title: "水管、電氣與建築工程合併或分開招標原則",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 4,
    lastModifiedAt: new Date("2019-01-01"),
    sourceUrl: "https://www.pcc.gov.tw/",
  },
  {
    slug: "international-competition-guidelines",
    title: "機關辦理公共工程國際競圖注意事項",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 5,
    lastModifiedAt: new Date("2021-01-01"),
    sourceUrl: "https://www.pcc.gov.tw/",
  },
  {
    slug: "mega-procurement-reporting-rules",
    title: "機關提報巨額採購使用情形及效益分析作業規定",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 6,
    lastModifiedAt: new Date("2022-01-01"),
    sourceUrl: "https://www.pcc.gov.tw/",
  },
  {
    slug: "turnkey-procurement-notice",
    title: "統包作業須知",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 7,
    lastModifiedAt: new Date("2022-01-01"),
    sourceUrl: "https://www.pcc.gov.tw/",
  },
  {
    slug: "review-committee-panel-points",
    title: "各機關採購評選委員會專家學者參考名單資料庫審議小組設置要點",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 8,
    lastModifiedAt: new Date("2021-01-01"),
    sourceUrl: "https://www.pcc.gov.tw/",
  },
  {
    slug: "expert-roster-db-points",
    title: "各機關採購評選委員會專家學者參考名單資料庫建置及除名作業要點",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 9,
    lastModifiedAt: new Date("2021-01-01"),
    sourceUrl: "https://www.pcc.gov.tw/",
  },
  {
    slug: "most-advantageous-tender-operations-manual",
    title: "最有利標作業手冊",
    tier: RegulationTier.ADMIN_RULE,
    sortOrder: 10,
    lastModifiedAt: new Date("2024-12-16"),
    sourceUrl: "https://www.pcc.gov.tw/content/list?eid=4581",
    notes:
      "工程會採購手冊（非 MOJ）；113.12.16 工程企字第1130100580號函修正。正式全文請自工程會「採購手冊及範例」下載 PDF 後依 PCC-匯入說明手動匯入。",
  },
  {
    slug: "pcc-procurement-amount-thresholds",
    title: "工程會採購金額門檻（函釋／公告彙整）",
    tier: RegulationTier.INTERPRETATION,
    sortOrder: 0,
    lastModifiedAt: new Date("2026-05-19"),
    sourceUrl: "https://www.pcc.gov.tw/",
    notes:
      "依工程會函釋與公告整理；原始檔：工程會函釋_金額門檻.txt。非 MOJ 條文，數額以工程會最新公告為準。",
  },
];

async function main() {
  for (const r of REGULATIONS) {
    await prisma.regulation.upsert({
      where: { slug: r.slug },
      create: r,
      update: {
        title: r.title,
        tier: r.tier,
        sortOrder: r.sortOrder,
        lastModifiedAt: r.lastModifiedAt,
        sourceUrl: r.sourceUrl,
        notes: r.notes ?? null,
      },
    });
  }
  console.log("Seeded regulations:", REGULATIONS.length);

  const ingested = await ingestCorpus("seed");
  console.log("Ingested knowledge base:", ingested);

  if (process.env.SKIP_QUESTION_BANK_IMPORT !== "1") {
    try {
      const qb = await importQuestionBank(prisma, "seed");
      clearQuestionBankCache();
      console.log("Imported question bank:", qb);
    } catch (e) {
      console.warn(
        "[seed] Question bank import skipped (login/regulations still OK). Run: npm run corpus:import-question-bank",
      );
      console.warn(e);
    }
  } else {
    console.log("Skipped question bank import (SKIP_QUESTION_BANK_IMPORT=1)");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
