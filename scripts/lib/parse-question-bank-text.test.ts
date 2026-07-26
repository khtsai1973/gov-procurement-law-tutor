import assert from "node:assert/strict";

import {
  inferSlugsAndCategory,
  isSectionTitle,
  mergeIncompleteQuestions,
  parseQuestionBankText,
  rawToEntries,
} from "./parse-question-bank-text";

const sample = `
工程及技術服務採購作業
選擇題
1 3 下列何項費用，不得納入建造費用？ (1)利潤。 (2)棄土費。 (3)管理費。 (4)保險費。
2 1 委託室內隔間設計，最適宜之廠商資格？ (1)建築師。 (2)營造業。 (3)景觀業。 (4)以上皆是。
是非題
1 X 機關辦理營造業法規定專業工程項目，不得排除綜合營造業。
2 O 工程施工查核小組應加以記錄。
`;

const raw = parseQuestionBankText(sample);
assert.equal(raw.length, 4);
const entries = rawToEntries(raw);
assert.equal(entries.length, 4);
assert.ok(entries[0]!.hintAnswer?.includes("【題庫】"));
assert.ok(entries[2]!.hintAnswer?.includes("X（非）"));
assert.equal(entries[0]!.category, "工程及技術服務採購作業");

const tightSpacing = `
工程及技術服務採購作業
選擇題
1 3下列何項費用，不得納入建造費用？ (1)利潤。 (2)棄土費。 (3)管理費。 (4)保險費。
2 1委託室內隔間設計，最適宜之廠商資格？ (1)建築師。 (2)營造業。 (3)景觀業。 (4)以上皆是。
`;
const tight = parseQuestionBankText(tightSpacing);
assert.equal(tight.length, 2, "pdf-parse style: no space after answer digit");
assert.equal(rawToEntries(tight).length, 2);

const answerNextLine = `
選擇題
1 3
下列何項費用，不得納入建造費用？ (1)利潤。 (2)棄土費。 (3)管理費。 (4)保險費。
2 1
委託室內隔間設計，最適宜之廠商資格？ (1)建築師。 (2)營造業。 (3)景觀業。 (4)以上皆是。
`;
const nextLine = parseQuestionBankText(answerNextLine);
assert.equal(nextLine.length, 2, "answer on same line as number, question on next line");

const sampleSplitColumns = `
工程及技術服務採購作業
選擇題
1
3
下列何項費用，不得納入建造費用？ (1)利潤。 (2)棄土費。 (3)管理費。 (4)保險費。
2
1
委託室內隔間設計，最適宜之廠商資格？ (1)建築師。 (2)營造業。 (3)景觀業。 (4)以上皆是。
`;
const split = parseQuestionBankText(sampleSplitColumns);
assert.equal(split.length, 2, "split-column: number / answer / question lines");

const pdfTableMerged = `
工程及技術服務採購作業
選擇題
13下列何項費用，不得納入建造費用計算技術服務費用？ (1)承包商的利潤。 (2)棄土費。 (3)管理費。 (4)保險費。
21委託辦理室內隔間設計服務，其最適宜訂定之廠商資格得為何？ (1)建築師 (2)營造業 (3)景觀業 (4)以上皆是
101關於採購法施行細則第22條第4項所稱「追加累計金額占原主契約金額之比率」，下列敘述何者正確？ (1)甲。 (2)乙。 (3)丙。 (4)丁。
`;
const merged = parseQuestionBankText(pdfTableMerged);
assert.equal(merged.length, 3, "pdf table: number+answer concatenated before question stem");
assert.equal(merged[0]!.number, "1");
assert.equal(merged[0]!.answer, "3");
assert.equal(merged[2]!.number, "10");
assert.equal(merged[2]!.answer, "1");

// 題幹換行片段不得當成分類
assert.equal(
  isSectionTitle("屬法令規定或契約約定應親自赴現場查驗、勘驗、初驗、驗收、會勘或出席"),
  false,
);
assert.equal(isSectionTitle("工程及技術服務採購作業"), true);
assert.equal(isSectionTitle("第 22 條"), true);

const wrappedOptionFragment = `
工程及技術服務採購作業
選擇題
1 3 機關委託廠商辦理技術服務，下列敘述何者錯誤？ (1)設計應符合節省能源。 (2)監造
建築師、技師執行監造業務，其
屬法令規定或契約約定應親自赴現場查驗、勘驗、初驗、驗收、會勘或出席
會議者，應配合到場辦理。 (3)錯誤選項。 (4)另一錯誤。
2 1 委託室內隔間設計，最適宜之廠商資格？ (1)建築師。 (2)營造業。 (3)景觀。 (4)皆是。
`;
const wrapped = parseQuestionBankText(wrappedOptionFragment);
assert.equal(wrapped.length, 2, "option wrap must not create new section/questions");
assert.ok(
  joinIncludes(wrapped[0]!, "會議者，應配合到場辦理"),
  "wrapped option text stays in same question",
);
assert.equal(sectionOf(wrapped[0]!), "工程及技術服務採購作業");

// 關鍵詞不得覆寫可信章節分類
const inferred = inferSlugsAndCategory(
  "機關辦理公告金額以上技術服務採購，下列何者正確？",
  "工程及技術服務採購作業｜選擇題",
);
assert.equal(inferred.category, "工程及技術服務採購作業");

const mergedIncomplete = mergeIncompleteQuestions([
  {
    number: "1",
    category: "題庫｜選擇題",
    questionType: "選擇題",
    questionLines: ["下列何者正確？ (1)甲。 (2)乙。"],
    answer: "1",
  },
  {
    number: "2",
    category: "題庫｜選擇題",
    questionType: "選擇題",
    questionLines: ["條及第102條規定辦理。"],
    answer: "2",
  },
]);
// 上一題已具問句與選項 → 殘片應丟棄，不可污染上一題
assert.equal(mergedIncomplete.length, 1);
assert.equal(joinIncludes(mergedIncomplete[0]!, "條及第102條規定辦理"), false);

const mergeIntoIncomplete = mergeIncompleteQuestions([
  {
    number: "1",
    category: "題庫｜選擇題",
    questionType: "選擇題",
    questionLines: ["下列敘述何者錯誤？ (1)甲"],
    answer: "1",
  },
  {
    number: "2",
    category: "題庫｜選擇題",
    questionType: "選擇題",
    questionLines: ["。 (2)乙。 (3)丙。 (4)丁。"],
    answer: "2",
  },
]);
assert.equal(mergeIntoIncomplete.length, 1);
assert.ok(joinIncludes(mergeIntoIncomplete[0]!, "(4)丁"));

console.log("parse-question-bank-text: ok");

function sectionOf(q: { category: string }): string {
  return q.category.split("｜")[0] ?? q.category;
}

function joinIncludes(q: { questionLines: string[] }, needle: string): boolean {
  return q.questionLines.join("").includes(needle);
}
