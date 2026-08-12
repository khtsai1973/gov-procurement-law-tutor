import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  goldenToRagEvalCase,
  listReadyGoldenItems,
  loadGoldenDataset,
  summarizeGoldenCoverage,
  validateGoldenDataset,
} from "./golden";
import { GOLDEN_CATEGORIES } from "./golden-types";
import { scoreCase } from "./run";

describe("golden dataset", () => {
  it("loads and validates phase1 ready count", () => {
    const ds = loadGoldenDataset();
    validateGoldenDataset(ds);
    assert.equal(ds.meta.phase1_count, 50);
    assert.equal(ds.meta.target_total, 100);
    const ready = listReadyGoldenItems(ds);
    assert.equal(ready.length, 50);
    const cov = summarizeGoldenCoverage(ds);
    assert.equal(cov.ready, 50);
    assert.equal(cov.planned, 50);
    for (const cat of GOLDEN_CATEGORIES) {
      assert.ok(cov.byCategory[cat]);
      assert.equal(
        cov.byCategory[cat]!.ready,
        ds.meta.category_plan[cat].phase1,
      );
    }
  });

  it("converts sample items to rag-eval cases", () => {
    const ready = listReadyGoldenItems();
    const art22 = ready.find((i) => i.id === "G024");
    assert.ok(art22);
    const c = goldenToRagEvalCase(art22!);
    assert.equal(c.id, "G024");
    assert.ok(c.reference_answer?.includes("不一定"));
    assert.ok(c.must_include.length > 0);

    const ood = ready.find((i) => i.id === "G049");
    assert.ok(ood);
    const refuse = goldenToRagEvalCase(ood!);
    assert.equal(refuse.kind, "off_topic");
    assert.deepEqual(refuse.contexts, []);
  });

  it("offline scores on gold answers stay high for key cases", () => {
    const ready = listReadyGoldenItems();
    for (const id of ["G009", "G024", "G046", "G049"]) {
      const item = ready.find((i) => i.id === id);
      assert.ok(item, id);
      const c = goldenToRagEvalCase(item!);
      const s = scoreCase({
        case: c,
        answer: item!.gold_answer,
        model: "gold-self",
      });
      assert.ok(s.faithfulness >= 0.7, `${id} faithfulness ${s.faithfulness}`);
      assert.ok(s.answer_relevance >= 0.5, `${id} relevance ${s.answer_relevance}`);
    }
  });
});
