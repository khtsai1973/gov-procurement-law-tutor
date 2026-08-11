import assert from "node:assert/strict";

import {
  awardMethodExpansionTerms,
  buildAwardMethodPrincipleAnswer,
  isAwardMethodPrincipleQuery,
} from "./award-method-principle";

assert.equal(
  isAwardMethodPrincipleQuery("100萬元以上的採購應依最低標原則辦理。"),
  true,
);
assert.equal(
  isAwardMethodPrincipleQuery("達公告金額以上是不是一律要採最低標？"),
  true,
);
assert.equal(
  isAwardMethodPrincipleQuery("最有利標和最低標有什麼不同？"),
  true,
);
assert.equal(
  isAwardMethodPrincipleQuery("採購法第52條決標原則有哪些？"),
  true,
);
assert.equal(
  isAwardMethodPrincipleQuery("最低標價超過底價時可以減價幾次？"),
  false,
);
assert.equal(isAwardMethodPrincipleQuery("公告金額是多少？"), false);

const ans = buildAwardMethodPrincipleAnswer();
assert.ok(ans.includes("不正確"));
assert.ok(ans.includes("第 52 條"));
assert.ok(ans.includes("最有利標"));
assert.ok(ans.includes("複數決標"));
assert.ok(ans.includes("專業服務"));
assert.ok(!/100\s*萬元以上.*必須依最低標/.test(ans));
assert.ok(ans.includes("150 萬"));

const terms = awardMethodExpansionTerms("100萬以上應採最低標嗎？");
assert.ok(terms.includes("第五十二條"));
assert.ok(terms.includes("最有利標"));

console.log("award-method-principle: ok");
