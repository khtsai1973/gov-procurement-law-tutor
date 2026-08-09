import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasFullExplanation,
  isHighImportance,
} from "@/lib/question-bank-types";
import {
  resetExplanationOverlayCache,
  resolveQuestionExplanation,
} from "@/lib/question-bank-explanations";
import { parseReferenceAnswer } from "@/lib/mock-exam";

describe("hasFullExplanation", () => {
  it("rejects short reference-only hints", () => {
    assert.equal(
      hasFullExplanation("【題庫】本題參考答案為 選項 (3)。正式作答須以檢索到的法規／函釋全文為準，勿僅依題庫背誦。"),
      false,
    );
  });

  it("accepts marker or long analysis", () => {
    assert.equal(hasFullExplanation("短\n【完整解析】\n說明"), true);
    assert.equal(hasFullExplanation("x".repeat(160)), true);
  });
});

describe("resolveQuestionExplanation", () => {
  it("overlays high-priority explanations and keeps grading answer", () => {
    resetExplanationOverlayCache();
    const resolved = resolveQuestionExplanation({
      key: "gpa-財物及勞務採購作業-mc-0024",
      hintAnswer: "【題庫】本題參考答案為 選項 (3)。正式作答須以檢索到的法規／函釋全文為準，勿僅依題庫背誦。",
      importance: "normal",
    });
    assert.equal(resolved.importance, "high");
    assert.equal(resolved.hasFullExplanation, true);
    assert.ok(resolved.hintAnswer?.includes("【完整解析】"));
    assert.equal(parseReferenceAnswer(resolved.hintAnswer, "MULTIPLE_CHOICE"), "3");
  });

  it("marks starter overlay keys as high importance", () => {
    resetExplanationOverlayCache();
    const resolved = resolveQuestionExplanation({
      key: "threshold-small-purchase",
      hintAnswer: "短提示",
    });
    assert.equal(resolved.importance, "high");
    assert.equal(resolved.hasFullExplanation, true);
  });
});

describe("isHighImportance", () => {
  it("respects explicit flag", () => {
    assert.equal(isHighImportance("high"), true);
    assert.equal(isHighImportance("normal", "短"), false);
  });
});
