import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** 與 rag.ts 中 RAG_ALLOWED_TIERS 保持一致 */
const RAG_ALLOWED_TIERS = new Set(["LAW", "REGULATION", "ADMIN_RULE", "INTERPRETATION"]);

describe("RAG source scope", () => {
  it("allows regulation / interpretation tiers only", () => {
    assert.equal(RAG_ALLOWED_TIERS.has("LAW"), true);
    assert.equal(RAG_ALLOWED_TIERS.has("REGULATION"), true);
    assert.equal(RAG_ALLOWED_TIERS.has("ADMIN_RULE"), true);
    assert.equal(RAG_ALLOWED_TIERS.has("INTERPRETATION"), true);
    assert.equal(RAG_ALLOWED_TIERS.has("QUESTION_BANK"), false);
  });
});
