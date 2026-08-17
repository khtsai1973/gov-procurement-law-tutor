import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  QUESTION_BANK_PAGE_SIZE,
  isDefaultQuestionBankQuery,
  parseQuestionBankListQuery,
  questionBankHref,
  type QuestionBankListItem,
} from "./question-bank-list";

describe("question-bank list query", () => {
  it("keeps page size small enough for client fetch", () => {
    assert.equal(QUESTION_BANK_PAGE_SIZE, 40);
  });

  it("parses filters and clamps page", () => {
    assert.deepEqual(
      parseQuestionBankListQuery({
        category: " 招標 ",
        q: " 第22條 ",
        important: "1",
        page: "3",
      }),
      { category: "招標", q: "第22條", important: true, page: 3 },
    );
    assert.equal(parseQuestionBankListQuery({ page: "0" }).page, 1);
    assert.equal(parseQuestionBankListQuery({ page: "nope" }).page, 1);
    assert.equal(parseQuestionBankListQuery({ important: "true" }).important, true);
  });

  it("builds list href without default page=1", () => {
    assert.equal(questionBankHref({}), "/question-bank");
    assert.equal(
      questionBankHref({ category: "招標", important: true, page: 2 }),
      "/question-bank?category=%E6%8B%9B%E6%A8%99&important=1&page=2",
    );
    assert.equal(questionBankHref({ page: 1 }), "/question-bank");
  });

  it("identifies default unfiltered first page", () => {
    assert.equal(isDefaultQuestionBankQuery(parseQuestionBankListQuery({})), true);
    assert.equal(isDefaultQuestionBankQuery(parseQuestionBankListQuery({ page: "2" })), false);
    assert.equal(isDefaultQuestionBankQuery(parseQuestionBankListQuery({ q: "22" })), false);
  });

  it("list item contract omits hintAnswer", () => {
    const sample: QuestionBankListItem = {
      id: "1",
      key: "GPA-1",
      question: "題幹",
      category: "招標",
      keywords: ["招標"],
      importance: "high",
      hasHint: true,
      hasFullExplanation: true,
    };
    assert.equal("hintAnswer" in sample, false);
    assert.equal("content" in sample, false);
  });
});
