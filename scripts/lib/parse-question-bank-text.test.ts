import assert from "node:assert/strict";

import { parseQuestionBankText, rawToEntries } from "./parse-question-bank-text";

const sample = `
工程及技術服務採購作業
選擇題
1 3 下列何項費用，不得納入建造費用？ (1)利潤。 (2)棄土費。
2 1 委託室內隔間設計，最適宜之廠商資格？ (1)建築師。 (2)營造業。
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

const tightSpacing = `
工程及技術服務採購作業
選擇題
1 3下列何項費用，不得納入建造費用？ (1)利潤。
2 1委託室內隔間設計，最適宜之廠商資格？ (1)建築師。
`;
const tight = parseQuestionBankText(tightSpacing);
assert.equal(tight.length, 2, "pdf-parse style: no space after answer digit");

const answerNextLine = `
選擇題
1 3
下列何項費用，不得納入建造費用？ (1)利潤。
2 1
委託室內隔間設計，最適宜之廠商資格？ (1)建築師。
`;
const nextLine = parseQuestionBankText(answerNextLine);
assert.equal(nextLine.length, 2, "answer on same line as number, question on next line");

const sampleSplitColumns = `
工程及技術服務採購作業
選擇題
1
3
下列何項費用，不得納入建造費用？
2
1
委託室內隔間設計，最適宜之廠商資格？
`;
const split = parseQuestionBankText(sampleSplitColumns);
assert.equal(split.length, 2, "split-column: number / answer / question lines");

const pdfTableMerged = `
工程及技術服務採購作業
選擇題
13下列何項費用，不得納入建造費用計算技術服務費用？ (1)承包商的利潤。
21委託辦理室內隔間設計服務，其最適宜訂定之廠商資格得為何？ (1)建築師
101關於採購法施行細則第22條第4項所稱「追加累計金額占原主契約金額之比率」，下列敘述何者正確？
`;
const merged = parseQuestionBankText(pdfTableMerged);
assert.equal(merged.length, 3, "pdf table: number+answer concatenated before question stem");
assert.equal(merged[0]!.number, "1");
assert.equal(merged[0]!.answer, "3");
assert.equal(merged[2]!.number, "10");
assert.equal(merged[2]!.answer, "1");

console.log("parse-question-bank-text: ok");
