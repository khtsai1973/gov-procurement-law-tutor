export type ScenarioTemplate = {
  id: string;
  label: string;
  body: string;
};

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "bidding",
    label: "招標",
    body: `【招標情境】
採購標的：（工程／財物／勞務）
採購金額：（     ）元（是否含稅：是／否）
招標方式：（公開招標／公開取得報價單／限制性招標／其他）
程序階段：（招標文件製作／公告／等標期／開標評標）

想請教：`,
  },
  {
    id: "evaluation",
    label: "評選／最有利標",
    body: `【評選／最有利標情境】
採購標的：
採購金額：
決標原則：最有利標
是否已組評選委員會：（是／否）
評選重點：（價格權重／技術／服務／其他）

想請教：`,
  },
  {
    id: "contract",
    label: "契約／履約",
    body: `【契約／履約情境】
契約類型：（工程／財物／勞務）
履約階段：（施作中／驗收／保固）
爭點：（逾期、驗收改善、契約變更、違約金等）

想請教：`,
  },
  {
    id: "threshold",
    label: "金額門檻",
    body: `【金額門檻情境】
採購標的：（工程／財物／勞務）
預算或估計採購金額：（     ）元
是否含後續擴充或選購：（是／否）
想確認：（查核金額／公告金額／巨額／小額／未達公告金額）

想請教：`,
  },
];
