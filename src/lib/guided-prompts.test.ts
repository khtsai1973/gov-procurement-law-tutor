import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getGuidedScenario,
  GUIDED_SCENARIOS,
  guidedAsScenarioTemplates,
} from "./guided-prompts";

describe("guided-prompts", () => {
  it("includes the three recommended scenario titles", () => {
    const titles = GUIDED_SCENARIOS.map((s) => s.title);
    assert.ok(titles.includes("決標方式判斷"));
    assert.ok(titles.includes("招標文件疑義處理"));
    assert.ok(titles.includes("履約爭議申訴"));
  });

  it("each scenario has template and starters", () => {
    for (const s of GUIDED_SCENARIOS) {
      assert.ok(s.template.includes("想請教："), s.id);
      assert.ok(s.starters.length >= 2, s.id);
      assert.ok(s.description.length > 0, s.id);
    }
  });

  it("looks up by id", () => {
    assert.equal(getGuidedScenario("award-method")?.title, "決標方式判斷");
    assert.equal(guidedAsScenarioTemplates().length, GUIDED_SCENARIOS.length);
  });
});
