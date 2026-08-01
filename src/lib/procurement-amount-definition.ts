/**
 * 「採購金額如何認定？是否含稅、後續擴充或選購？」類問題的確定性回答。
 * 主要依據《政府採購法施行細則》第 6 條。
 */

import { isAmountTierClassificationQuery, parseAmountTwd } from "@/lib/amount-tier";

/** 是否為詢問採購金額認定方式（含稅／選購／後續擴充） */
export function isProcurementAmountDefinitionQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;

  if (isAmountTierClassificationQuery(q) && parseAmountTwd(q) != null) {
    return false;
  }

  if (!/採購金額/.test(q)) return false;

  const asksHow =
    /認定|如何算|怎麼算|怎麼認|計算方式|如何計算|如何認定|怎麼認定/.test(q);
  const asksComponents = /含稅|營業稅|後續擴充|選購/.test(q);

  return asksHow || asksComponents;
}

/** 確定性回答（施行細則第 6 條重點） */
export function buildProcurementAmountDefinitionAnswer(): string {
  return [
    "結論：依據台灣《政府採購法施行細則》第 6 條規定，採購金額應於招標前認定，且必須計入預估之選購或後續擴充項目金額，同時除招標文件另有規定外，原則上應為含稅金額（包含營業稅）。",
    "",
    "說明：",
    "1. 認定時點：巨額、查核金額以上、公告金額以上或小額採購，均依採購金額於招標前認定（《政府採購法施行細則》第 6 條本文）。",
    "2. 選購／後續擴充：招標文件含有選購或後續擴充項目者，應將預估選購或擴充項目所需金額計入（同條第 3 款）。",
    "3. 含稅原則：除招標文件另有規定外，採購金額原則上應為含稅金額（包含營業稅）。",
    "4. 其他常見計算方式（同條）：例如分批採購依全部批數預算總額；複數決標原則依全部項目或數量之預算總額等。",
    "",
    "法規來源：《政府採購法施行細則》第 6 條。",
  ].join("\n");
}
