import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProcurementAmountDefinitionAnswer,
  isProcurementAmountDefinitionQuery,
} from "@/lib/procurement-amount-definition";

describe("isProcurementAmountDefinitionQuery", () => {
  it("matches definition / tax / expansion questions", () => {
    assert.equal(
      isProcurementAmountDefinitionQuery("採購金額如何認定？是否含稅、後續擴充或選購？"),
      true,
    );
    assert.equal(isProcurementAmountDefinitionQuery("採購金額要不要含稅？"), true);
    assert.equal(isProcurementAmountDefinitionQuery("後續擴充要不要計入採購金額？"), true);
  });

  it("rejects unrelated amount questions", () => {
    assert.equal(
      isProcurementAmountDefinitionQuery("今年的查核金額、公告金額各是多少？"),
      false,
    );
    assert.equal(isProcurementAmountDefinitionQuery("小額採購的金額門檻是多少？"), false);
    assert.equal(
      isProcurementAmountDefinitionQuery("新臺幣250萬元資訊服務採購屬哪個金額級距？"),
      false,
    );
  });
});

describe("buildProcurementAmountDefinitionAnswer", () => {
  it("states Art.6 timing, expansion, and tax principles", () => {
    const ans = buildProcurementAmountDefinitionAnswer();
    assert.ok(ans.includes("施行細則》第 6 條"));
    assert.ok(ans.includes("招標前認定"));
    assert.ok(ans.includes("選購或後續擴充"));
    assert.ok(ans.includes("含稅金額"));
    assert.ok(ans.includes("營業稅"));
  });
});
