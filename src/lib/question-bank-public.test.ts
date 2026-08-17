import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  QUESTION_BANK_CACHE_TAG,
  QUESTION_BANK_LIST_REVALIDATE_SEC,
  QUESTION_BANK_PAGE_SIZE,
} from "./question-bank-public";
import {
  REGULATIONS_CACHE_TAG,
  REGULATIONS_LIST_REVALIDATE_SEC,
} from "./regulations-public";

describe("question-bank-public cache config", () => {
  it("uses short revalidate window for category stats", () => {
    assert.equal(QUESTION_BANK_LIST_REVALIDATE_SEC, 60);
    assert.equal(QUESTION_BANK_CACHE_TAG, "question-bank-public");
    assert.equal(QUESTION_BANK_PAGE_SIZE, 40);
  });
});

describe("regulations-public cache config", () => {
  it("uses 5-minute revalidate for regulation list", () => {
    assert.equal(REGULATIONS_LIST_REVALIDATE_SEC, 300);
    assert.equal(REGULATIONS_CACHE_TAG, "regulations-public");
  });
});
