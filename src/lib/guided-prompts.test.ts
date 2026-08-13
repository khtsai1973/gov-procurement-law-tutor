import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assembleGuidedPrompt,
  defaultSlotValues,
  getGuidedScenario,
  GUIDED_SCENARIOS,
  guidedAsScenarioTemplates,
  validateSlotValues,
} from "./guided-prompts";

describe("guided-prompts", () => {
  it("includes the three recommended scenario titles", () => {
    const titles = GUIDED_SCENARIOS.map((s) => s.title);
    assert.ok(titles.includes("決標方式判斷"));
    assert.ok(titles.includes("招標文件疑義處理"));
    assert.ok(titles.includes("履約爭議申訴"));
  });

  it("each scenario has slots, template and starters", () => {
    for (const s of GUIDED_SCENARIOS) {
      assert.ok(s.template.includes("想請教："), s.id);
      assert.ok(s.starters.length >= 2, s.id);
      assert.ok(s.description.length > 0, s.id);
      assert.ok(s.slots.length >= 2, `${s.id} should have dynamic slots`);
      assert.ok(
        s.slots.some((slot) => slot.required),
        `${s.id} should require at least one slot`,
      );
    }
  });

  it("looks up by id", () => {
    assert.equal(getGuidedScenario("award-method")?.title, "決標方式判斷");
    assert.equal(guidedAsScenarioTemplates().length, GUIDED_SCENARIOS.length);
  });

  it("validates required slot values", () => {
    const s = getGuidedScenario("award-method")!;
    assert.match(validateSlotValues(s, defaultSlotValues(s)) ?? "", /採購標的|採購金額/);
    const ok = validateSlotValues(s, {
      ...defaultSlotValues(s),
      subject: "資訊服務（屬勞務）",
      amountWan: "250",
      awardPrinciple: "最有利標",
    });
    assert.equal(ok, null);
  });

  it("assembles structured prompt with amount in TWD and ask text", () => {
    const s = getGuidedScenario("amount-tier")!;
    const prompt = assembleGuidedPrompt({
      scenario: s,
      values: {
        subject: "資訊服務（屬勞務）",
        amountWan: "250",
        includeFollowOn: "否",
      },
      ask: "屬哪一級距？",
    });
    assert.match(prompt, /結構化案情/);
    assert.match(prompt, /資訊服務/);
    assert.match(prompt, /2,500,000|2500000|250 萬/);
    assert.match(prompt, /想請教：/);
    assert.match(prompt, /屬哪一級距/);
  });

  it("assembles award-method slots into citation-friendly block", () => {
    const s = getGuidedScenario("award-method")!;
    const prompt = assembleGuidedPrompt({
      scenario: s,
      values: {
        subject: "勞務",
        amountWan: "100",
        taxIncluded: "是",
        awardPrinciple: "最低標",
        specialService: "否",
      },
      ask: "100萬元以上應依最低標原則辦理。這樣說對嗎？",
    });
    assert.match(prompt, /決標方式判斷/);
    assert.match(prompt, /最低標/);
    assert.match(prompt, /是否含稅：是/);
  });
});
