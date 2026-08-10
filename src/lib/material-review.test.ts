import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendRevisionLog,
  canApproveMaterial,
  canPublishMaterial,
  canReturnMaterial,
  canSubmitForReview,
  materialPublishBlockReason,
  materialStatusLabel,
  normalizeReviewStatus,
  parseRevisionLog,
} from "./material-review";

describe("material workflow statuses", () => {
  it("normalizes legacy NONE to DRAFT", () => {
    assert.equal(normalizeReviewStatus("NONE"), "DRAFT");
    assert.equal(normalizeReviewStatus(null), "DRAFT");
  });

  it("labels five display states", () => {
    assert.equal(materialStatusLabel({ reviewStatus: "DRAFT", published: false }), "草稿");
    assert.equal(
      materialStatusLabel({ reviewStatus: "PENDING_REVIEW", published: false }),
      "待審",
    );
    assert.equal(materialStatusLabel({ reviewStatus: "APPROVED", published: false }), "已核准");
    assert.equal(materialStatusLabel({ reviewStatus: "APPROVED", published: true }), "已發布");
    assert.equal(
      materialStatusLabel({ reviewStatus: "RETURNED", published: false }),
      "退回修正",
    );
  });

  it("gates AI publish until approved", () => {
    assert.equal(
      canPublishMaterial({ source: "AI", reviewStatus: "PENDING_REVIEW" }),
      false,
    );
    assert.equal(canPublishMaterial({ source: "AI", reviewStatus: "RETURNED" }), false);
    assert.equal(canPublishMaterial({ source: "AI", reviewStatus: "APPROVED" }), true);
    assert.equal(canPublishMaterial({ source: "MANUAL", reviewStatus: "DRAFT" }), true);
    assert.ok(materialPublishBlockReason({ source: "AI", reviewStatus: "PENDING_REVIEW" }));
  });

  it("supports submit / approve / return transitions", () => {
    assert.equal(canSubmitForReview({ reviewStatus: "DRAFT", published: false }), true);
    assert.equal(canSubmitForReview({ reviewStatus: "RETURNED", published: false }), true);
    assert.equal(
      canSubmitForReview({ reviewStatus: "PENDING_REVIEW", published: false }),
      false,
    );
    assert.equal(
      canApproveMaterial({ reviewStatus: "PENDING_REVIEW", published: false }),
      true,
    );
    assert.equal(canReturnMaterial({ reviewStatus: "PENDING_REVIEW" }), true);
    assert.equal(canReturnMaterial({ reviewStatus: "APPROVED" }), true);
    assert.equal(canReturnMaterial({ reviewStatus: "DRAFT" }), false);
  });

  it("appends revision log entries", () => {
    const json = appendRevisionLog(null, {
      at: "2026-08-10T00:00:00.000Z",
      byId: "u1",
      byName: "老師",
      note: "初審退回",
      fromStatus: "PENDING_REVIEW",
      toStatus: "RETURNED",
    });
    const list = parseRevisionLog(json);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.toStatus, "RETURNED");
  });
});
