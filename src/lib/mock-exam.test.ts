import assert from "node:assert/strict";

import {
  buildMockExamCategoryOptions,
  inferMockExamQuestionType,
} from "./mock-exam";

assert.equal(
  inferMockExamQuestionType({ key: "gpa-金額門檻-mc-0001", question: "下列何者正確？ (1)甲。 (2)乙。" }),
  "MULTIPLE_CHOICE",
);
assert.equal(
  inferMockExamQuestionType({ key: "gpa-第-22-條-tf-0010", question: "機關應公開招標。" }),
  "TRUE_FALSE",
);
assert.equal(
  inferMockExamQuestionType({ key: "old-選擇題-1", question: "測試" }),
  "MULTIPLE_CHOICE",
);

const cats = buildMockExamCategoryOptions([
  { category: "金額門檻", key: "gpa-金額門檻-mc-0001", question: "(1)甲 (2)乙" },
  { category: "金額門檻", key: "gpa-金額門檻-tf-0002", question: "是非" },
  { category: "最有利標", key: "gpa-最有利標-mc-0003", question: "(1)甲" },
]);
assert.equal(cats.length, 2);
assert.equal(cats.find((c) => c.name === "金額門檻")?.mcCount, 1);
assert.equal(cats.find((c) => c.name === "金額門檻")?.tfCount, 1);
assert.equal(cats.find((c) => c.name === "最有利標")?.count, 1);

console.log("mock-exam: ok");
