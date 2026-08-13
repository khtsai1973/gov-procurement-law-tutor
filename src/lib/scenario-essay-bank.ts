/**
 * 階段 3：採購實務情境申論題庫（開放式）。
 * 題目內建於程式，不依賴題庫 MC／TF 匯入格式。
 */

export type ScenarioEssayRubricFocus = {
  /** 評分時應核對的法條／要點提示（給 LLM，非給學員） */
  mustCover: string[];
  /** 常見錯誤（扣分參考） */
  commonPitfalls: string[];
};

export type ScenarioEssayQuestion = {
  id: string;
  title: string;
  /** 情境題幹 */
  prompt: string;
  /** 知識標籤（展示用） */
  tags: string[];
  /** RAG 加權用 slug */
  relatedSlugs: string[];
  /** 評分焦點（不顯示給學員作答前） */
  rubricFocus: ScenarioEssayRubricFocus;
  /** 示範回答骨架（fallback／評分對照用） */
  modelAnswerOutline: string;
};

export const SCENARIO_ESSAY_QUESTIONS: ScenarioEssayQuestion[] = [
  {
    id: "se-art63-overdue-labor",
    title: "勞務履約逾期與第 63 條／契約處置",
    prompt:
      "機關辦理某勞務採購，廠商履約逾期 10 天，應如何依採購法第 63 條及契約規定處置？請說明法律依據、契約對照重點與機關可採行之程序。",
    tags: ["履約管理", "採購契約", "逾期違約金", "第63條"],
    relatedSlugs: ["government-procurement-act", "procurement-contract-essentials"],
    rubricFocus: {
      mustCover: [
        "採購法第63條第1項：契約以主管機關範本為原則；第2項：執行錯誤、不實或管理不善致損害之責任",
        "逾期處置主要依契約所載履約期限、逾期違約金（採購契約要項）及個案可歸責性",
        "應區分「可歸責於廠商」與「可延長期限／不計違約金」情形",
        "程序：事實確認 → 依約計算／通知催告 → 違約金扣抵或請求 → 必要時終止／解除／求償",
      ],
      commonPitfalls: [
        "誤認第63條本身即規定「逾期每日罰多少」之計算公式",
        "未對照契約條款與採購契約要項之逾期違約金規定",
        "忽略不可歸責或得延長期限之情事",
        "直接主張停權或刑責而無契約／法律依據",
      ],
    },
    modelAnswerOutline: [
      "一、法條定位：政府採購法第63條規範採購契約應以主管機關範本為原則，並應訂明一方執行錯誤、不實或管理不善致他方損害之責任；逾期日數之具體計算與違約金多依契約及採購契約要項辦理，而非逕由第63條訂出罰則公式。",
      "二、契約對照：查閱契約履約期限、逾期違約金（損害賠償額預定）、上限（如契約價金總額20%）、不計逾期之事由及通知方式。",
      "三、程序：確認逾期事實與可歸責性 → 依約計算違約金並通知廠商 → 得自應付價金扣抵 → 情節重大或經催告仍不履行時，依約終止／解除並得依第63條第2項等請求損害賠償。",
      "四、注意：若有不可歸責於廠商或契約明定得延長期限之事由，應審酌延長履約期限，不宜逕計違約金。",
    ].join("\n"),
  },
  {
    id: "se-art22-open-selection-goods",
    title: "財物案誤用第22條第1項第9款",
    prompt:
      "機關辦理公告金額以上之財物採購，承辦人擬依政府採購法第22條第1項第9款以「公開評選」之限制性招標辦理，並主張第一次開標僅需一家合格廠商即可。請評析此作法是否合法，並說明正確之招標方式與開標家數原則。",
    tags: ["限制性招標", "第22條", "公開評選", "開標家數"],
    relatedSlugs: ["government-procurement-act", "gpa-enforcement-rules"],
    rubricFocus: {
      mustCover: [
        "第22條第1項第9款適用範圍限於委託專業／技術／資訊／社福服務（勞務），不適用財物／工程",
        "公開招標第一次開標原則須三家以上合格廠商（第48條、施行細則相關規定）",
        "財物案不得僅因「公開評選」字樣套用第9款一家即可之規則",
      ],
      commonPitfalls: [
        "認為只要採限制性招標就一律免三家",
        "未區分標的屬性（工程／財物／勞務）",
        "混淆第22條其他款次與第9款",
      ],
    },
    modelAnswerOutline: [
      "結論：財物採購不得依第22條第1項第9款辦理公開評選之限制性招標；該款僅適用特定勞務服務。",
      "若採公開招標，第一次開標原則應有三家以上合格廠商；不得主張「第一次開標僅需一家」。",
      "應回歸標的屬性與法定招標方式，必要時依第22條其他款次之構成要件檢視是否符限制性招標。",
    ].join("\n"),
  },
  {
    id: "se-protest-deadline",
    title: "異議期限起算與逾期效果",
    prompt:
      "廠商認為招標文件內容違反法令，於領標後第12日始向招標機關提出異議。機關以「已逾異議期限」駁回。請依採購法爭議處理規定，說明異議標的、期限起算原則，以及機關駁回時應注意之合法性審查要點。",
    tags: ["異議", "申訴", "爭議處理", "期限計算"],
    relatedSlugs: ["government-procurement-act", "gpa-enforcement-rules"],
    rubricFocus: {
      mustCover: [
        "異議／申訴之標的區分（招標文件、招標過程、決標結果等）",
        "期限起算與「知悉」或公告／領標時點之關係（依題旨對應法條）",
        "逾期異議之程序效果與機關仍應為之合法性審查義務（若檢索片段有據）",
      ],
      commonPitfalls: [
        "混淆異議與申訴受理機關",
        "期限起算點錯誤（一律自決標日起算）",
        "認為逾期即可完全無視實體違法疑義",
      ],
    },
    modelAnswerOutline: [
      "先定性異議標的為招標文件內容違法，對照採購法異議期限與起算規定。",
      "說明領標後第12日提出是否已逾期，須依法定期間與起算時點判斷。",
      "機關以逾期駁回時，仍應注意程序記載完備，並依規定告知後續救濟途徑（如申訴）。",
    ].join("\n"),
  },
  {
    id: "se-award-method-threshold",
    title: "決標原則與金額門檻",
    prompt:
      "有人主張「採購金額達公告金額或逾100萬元即應一律採最低標」。請依政府採購法第52條說明決標原則之正確理解，並舉例機關得採最有利標或其他原則之情形（須附理由）。",
    tags: ["決標原則", "第52條", "最有利標", "金額門檻"],
    relatedSlugs: [
      "government-procurement-act",
      "most-advantageous-tender-selection-rules",
      "most-advantageous-tender-operations-manual",
    ],
    rubricFocus: {
      mustCover: [
        "第52條決標原則非「逾一定金額一律最低標」",
        "機關得依採購特性擇最低標、最有利標或其他原則",
        "最有利標有其適用條件與程序（評選等），不得空泛主張",
      ],
      commonPitfalls: [
        "把金額門檻與決標原則混為一談",
        "認為最有利標僅限巨額或特定標的",
        "未引用第52條而僅談實務習慣",
      ],
    },
    modelAnswerOutline: [
      "否定「逾100萬／達公告金額一律最低標」之誤解。",
      "依第52條說明機關得就最低標、最有利標等原則擇一，並敘明應考量之因素。",
      "舉例：規格難以完全量化、需評選品質或創意時，得採最有利標並依相關辦法辦理。",
    ].join("\n"),
  },
];

export function getScenarioEssayQuestion(id: string): ScenarioEssayQuestion | null {
  return SCENARIO_ESSAY_QUESTIONS.find((q) => q.id === id) ?? null;
}

export function listScenarioEssayQuestions(): Array<
  Pick<ScenarioEssayQuestion, "id" | "title" | "prompt" | "tags">
> {
  return SCENARIO_ESSAY_QUESTIONS.map(({ id, title, prompt, tags }) => ({
    id,
    title,
    prompt,
    tags,
  }));
}
