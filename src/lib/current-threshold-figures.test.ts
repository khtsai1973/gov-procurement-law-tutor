import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCurrentThresholdFiguresAnswer,
  isCurrentThresholdFiguresQuery,
} from "@/lib/current-threshold-figures";

describe("isCurrentThresholdFiguresQuery", () => {
  it("matches asking current audit/announce amounts", () => {
    assert.equal(isCurrentThresholdFiguresQuery("今年的查核金額、公告金額各是多少？"), true);
    assert.equal(isCurrentThresholdFiguresQuery("現行查核金額與公告金額是多少"), true);
    assert.equal(isCurrentThresholdFiguresQuery("公告金額、查核金額各是多少元？"), true);
  });

  it("rejects classification / unrelated queries", () => {
    assert.equal(
      isCurrentThresholdFiguresQuery("新臺幣250萬元資訊服務採購屬哪個金額級距？"),
      false,
    );
    assert.equal(isCurrentThresholdFiguresQuery("未達公告金額採購什麼時候要會同監辦？"), false);
    assert.equal(isCurrentThresholdFiguresQuery("什麼是查核金額？"), false);
    assert.equal(
      isCurrentThresholdFiguresQuery("查核金額、公告金額、巨額採購有什麼差別？"),
      false,
    );
  });
});

describe("buildCurrentThresholdFiguresAnswer", () => {
  it("states the correct current figures", () => {
    const ans = buildCurrentThresholdFiguresAnswer();
    assert.ok(ans.includes("工程及財物採購新臺幣 5,000 萬元"));
    assert.ok(ans.includes("勞務採購新臺幣 1,000 萬元"));
    assert.ok(ans.includes("公告金額則一律為新臺幣 150 萬元"));
  });
});
