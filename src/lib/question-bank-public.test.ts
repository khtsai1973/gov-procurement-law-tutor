import { describe, expect, it } from "vitest";

import {
  QUESTION_BANK_CACHE_TAG,
  QUESTION_BANK_LIST_REVALIDATE_SEC,
} from "@/lib/question-bank-public";
import {
  REGULATIONS_CACHE_TAG,
  REGULATIONS_LIST_REVALIDATE_SEC,
} from "@/lib/regulations-public";

describe("question-bank-public cache config", () => {
  it("uses short revalidate window for category stats", () => {
    expect(QUESTION_BANK_LIST_REVALIDATE_SEC).toBe(60);
    expect(QUESTION_BANK_CACHE_TAG).toBe("question-bank-public");
  });
});

describe("regulations-public cache config", () => {
  it("uses 5-minute revalidate for regulation list", () => {
    expect(REGULATIONS_LIST_REVALIDATE_SEC).toBe(300);
    expect(REGULATIONS_CACHE_TAG).toBe("regulations-public");
  });
});
