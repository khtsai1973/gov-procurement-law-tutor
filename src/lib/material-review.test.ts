import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canPublishMaterial,
  materialPublishBlockReason,
  materialStatusLabel,
} from "./material-review";

describe("material review gate", () => {
  it("allows manual materials to publish without review", () => {
    assert.equal(canPublishMaterial({ source: "MANUAL", reviewStatus: "NONE" }), true);
    assert.equal(materialStatusLabel({ source: "MANUAL", published: false }), "草稿");
    assert.equal(materialStatusLabel({ source: "MANUAL", published: true }), "已發布");
  });

  it("blocks AI publish until approved", () => {
    assert.equal(
      canPublishMaterial({ source: "AI", reviewStatus: "PENDING_REVIEW" }),
      false,
    );
    assert.ok(materialPublishBlockReason({ source: "AI", reviewStatus: "PENDING_REVIEW" }));
    assert.equal(
      canPublishMaterial({ source: "AI", reviewStatus: "APPROVED" }),
      true,
    );
  });

  it("labels AI review and publish states", () => {
    assert.equal(
      materialStatusLabel({ source: "AI", reviewStatus: "PENDING_REVIEW", published: false }),
      "待審核",
    );
    assert.equal(
      materialStatusLabel({ source: "AI", reviewStatus: "APPROVED", published: false }),
      "審核完成",
    );
    assert.equal(
      materialStatusLabel({ source: "AI", reviewStatus: "APPROVED", published: true }),
      "審核完成・已發布",
    );
  });
});
