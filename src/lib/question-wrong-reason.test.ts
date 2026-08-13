import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWrongChoiceUserDirective,
  extractCognitiveBrief,
  WRONG_CHOICE_DIAGNOSIS_SYSTEM,
} from "./question-wrong-reason";

describe("wrong-choice LLM diagnosis prompt", () => {
  it("builds the product-specified user directive", () => {
    const text = buildWrongChoiceUserDirective({
      userChoiceLabel: "選項 (2)",
      correctChoiceLabel: "選項 (1)",
      userOptionText: "以公開招標最低標辦理",
      correctOptionText: "得採限制性招標",
    });
    assert.match(text, /使用者選擇了 選項 \(2\)/);
    assert.match(text, /標準答案為 選項 \(1\)/);
    assert.match(text, /常見認知誤區/);
    assert.match(text, /2 句話/);
    assert.match(text, /採購法適用條件/);
  });

  it("system prompt requires cognitive + 2-sentence diff sections", () => {
    assert.match(WRONG_CHOICE_DIAGNOSIS_SYSTEM, /認知誤區/);
    assert.match(WRONG_CHOICE_DIAGNOSIS_SYSTEM, /適用條件差異/);
    assert.match(WRONG_CHOICE_DIAGNOSIS_SYSTEM, /恰好 2 句/);
  });

  it("extracts cognitive brief from analysis markdown", () => {
    const brief = extractCognitiveBrief(`## 認知誤區
把公開招標家數規則套到限制性招標。

## 適用條件差異
選項 (1) 適用第22條第1項第9款勞務公開評選。
選項 (2) 適用公開招標三家規定，條件不同。

## 弱點提示
複習第22條適用範圍。`);
    assert.ok(brief);
    assert.match(brief!, /認知誤區/);
    assert.match(brief!, /適用條件差異/);
    assert.match(brief!, /第22條/);
  });
});
