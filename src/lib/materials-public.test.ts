import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MATERIALS_LIST_REVALIDATE_SEC,
  type PublishedMaterialSummary,
} from "./materials-public";

describe("materials public list contract", () => {
  it("keeps list revalidate window short for freshness", () => {
    assert.ok(MATERIALS_LIST_REVALIDATE_SEC <= 120);
    assert.ok(MATERIALS_LIST_REVALIDATE_SEC >= 30);
  });

  it("summary type does not require content field", () => {
    const sample: PublishedMaterialSummary = {
      id: "m1",
      title: "標題",
      category: "政府採購全生命週期概論",
      unitCode: "U01",
      summary: "摘要",
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "AI",
      aiGeneratedAt: null,
      reviewedAt: null,
      regulationVersion: null,
      lastRevisionAt: null,
      lastRevisionNote: null,
      authorName: "老師",
    };
    assert.equal("content" in sample, false);
    assert.ok(sample.summary);
  });
});
