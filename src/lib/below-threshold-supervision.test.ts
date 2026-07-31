import assert from "node:assert/strict";

import {
  buildBelowThresholdSupervisionAnswer,
  isBelowThresholdSupervisionQuery,
} from "./below-threshold-supervision";

assert.equal(isBelowThresholdSupervisionQuery("未達公告金額採購什麼時候要會同監辦？"), true);
assert.equal(isBelowThresholdSupervisionQuery("公告金額以上要不要會同監辦？"), false);
assert.equal(isBelowThresholdSupervisionQuery("未達公告金額怎麼公開取得報價？"), false);

const ans = buildBelowThresholdSupervisionAnswer();
assert.ok(ans.includes("逾公告金額十分之一"));
assert.ok(ans.includes("開標、比價、議價、決標及驗收"));
assert.ok(ans.includes("十分之一以下"));
assert.ok(ans.includes("中央機關未達公告金額採購監辦辦法"));
assert.ok(!/應由其主（會）計及有關單位會同監辦/.test(ans));

console.log("below-threshold-supervision: ok");
