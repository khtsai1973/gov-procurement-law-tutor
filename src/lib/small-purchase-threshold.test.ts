import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSmallPurchaseThresholdAnswer,
  isSmallPurchaseThresholdQuery,
} from "@/lib/small-purchase-threshold";

describe("isSmallPurchaseThresholdQuery", () => {
  it("matches asking small-purchase threshold amount", () => {
    assert.equal(isSmallPurchaseThresholdQuery("小額採購的金額門檻是多少？"), true);
    assert.equal(isSmallPurchaseThresholdQuery("小額採購門檻多少元？"), true);
    assert.equal(isSmallPurchaseThresholdQuery("中央機關小額採購金額是多少"), true);
  });

  it("rejects unrelated queries", () => {
    assert.equal(isSmallPurchaseThresholdQuery("未達公告金額和小額採購是一樣的嗎？"), false);
    assert.equal(
      isSmallPurchaseThresholdQuery("今年的查核金額、公告金額各是多少？"),
      false,
    );
    assert.equal(
      isSmallPurchaseThresholdQuery("新臺幣250萬元資訊服務採購屬哪個金額級距？"),
      false,
    );
  });
});

describe("buildSmallPurchaseThresholdAnswer", () => {
  it("states the correct central-agency threshold", () => {
    const ans = buildSmallPurchaseThresholdAnswer();
    assert.ok(ans.includes("新臺幣 15 萬元以下"));
    assert.ok(ans.includes("公告金額 150 萬元的十分之一以下"));
    assert.ok(ans.includes("中央機關"));
  });
});
