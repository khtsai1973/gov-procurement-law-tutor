import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeKnowledgeRadar, STRONG_PCT_THRESHOLD } from "@/lib/knowledge-radar";
import { resolveAllQuestionTags, resolveKnowledgeTags } from "@/lib/knowledge-tags";

describe("knowledge tags", () => {
  it("maps official categories and keyword rules", () => {
    const tags = resolveKnowledgeTags({
      category: "最有利標及評選優勝廠商",
      keywords: ["公告金額", "評選"],
      relatedSlugs: ["most-advantageous-tender-selection-rules"],
      question: "最有利標評選委員會如何組成？",
    });
    assert.ok(tags.includes("決標與評選"));
    assert.ok(tags.includes("金額門檻"));
  });

  it("keeps explicit controlled tags", () => {
    const tags = resolveKnowledgeTags({
      category: "電子採購實務",
      knowledgeTags: ["電子採購", "不是合法標籤"],
      keywords: ["電子投標"],
      relatedSlugs: [],
      question: "電子領標",
    });
    assert.deepEqual(
      tags.filter((t) => t === "電子採購"),
      ["電子採購"],
    );
    assert.ok(!(tags as string[]).includes("不是合法標籤"));
  });

  it("resolveAllQuestionTags merges axes with article and concept tags", () => {
    const tags = resolveAllQuestionTags({
      category: "政府採購法之總則、招標及決標",
      question: "依第22條第1項第7款限制性招標，金額門檻如何計算？",
      keywords: [],
      relatedSlugs: [],
    });
    assert.ok(tags.includes("招標程序") || tags.includes("金額門檻"));
    assert.ok(tags.includes("第22條第1項第7款"));
    assert.ok(tags.includes("限制性招標"));
  });
});

describe("knowledge radar rule engine", () => {
  it("computes pct and weak tags from wrong answers", () => {
    const radar = computeKnowledgeRadar([
      { revealed: true, isCorrect: true, tags: ["招標程序", "金額門檻"] },
      { revealed: true, isCorrect: false, tags: ["金額門檻"] },
      { revealed: true, isCorrect: false, tags: ["金額門檻", "決標與評選"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: false, isCorrect: null, tags: ["爭議處理"] },
    ]);
    const amount = radar.axes.find((a) => a.tag === "金額門檻");
    assert.ok(amount);
    assert.equal(amount!.total, 3);
    assert.equal(amount!.wrong, 2);
    assert.equal(amount!.pct, 33);
    assert.ok(radar.weakTags.includes("金額門檻"));
    assert.ok(!radar.axes.some((a) => a.tag === "爭議處理"));
  });

  it(`marks strong tags only at >= ${STRONG_PCT_THRESHOLD}%`, () => {
    const radar = computeKnowledgeRadar([
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: false, tags: ["招標程序"] }, // 80%
      { revealed: true, isCorrect: true, tags: ["電子採購"] },
      { revealed: true, isCorrect: true, tags: ["電子採購"] },
      { revealed: true, isCorrect: true, tags: ["電子採購"] },
      { revealed: true, isCorrect: true, tags: ["電子採購"] },
      { revealed: true, isCorrect: true, tags: ["電子採購"] },
      { revealed: true, isCorrect: true, tags: ["電子採購"] },
      { revealed: true, isCorrect: true, tags: ["電子採購"] }, // 100%
    ]);
    assert.equal(STRONG_PCT_THRESHOLD, 85);
    assert.ok(!radar.strongTags.includes("招標程序"));
    assert.ok(radar.strongTags.includes("電子採購"));
  });
});
