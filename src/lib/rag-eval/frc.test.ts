import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreCitationAccuracyDetailed, scoreFRC } from "./frc";

describe("FRC metrics", () => {
  it("scores high FRC on grounded gold answer with articles", () => {
    const answer =
      "結論：依政府採購法第48條，公開招標第一次開標應有三家以上合格廠商。[片段1]";
    const s = scoreFRC({
      question: "公開招標第一次開標至少幾家合格廠商？",
      answer,
      contexts: [
        "政府採購法第48條：公開招標第一次開標，合格廠商應達三家以上。",
      ],
      mustInclude: ["三家", "第48條", "公開招標"],
      relevanceKeywords: ["公開招標", "合格廠商", "三家"],
      expectedArticles: ["第48條"],
      expectedSources: ["government-procurement-act"],
      behavior: "answer",
    });
    assert.ok(s.faithfulness >= 0.7, String(s.faithfulness));
    assert.ok(s.relevance >= 0.7, String(s.relevance));
    assert.ok((s.citation_accuracy ?? 0) >= 0.7, String(s.citation_accuracy));
    assert.ok(s.frc_mean >= 0.7, String(s.frc_mean));
  });

  it("refuse skips citation and keeps high F/R for OOD", () => {
    const s = scoreFRC({
      question: "今天天氣如何？",
      answer: "非本主題的範圍",
      contexts: [],
      behavior: "refuse",
    });
    assert.equal(s.faithfulness, 1);
    assert.equal(s.relevance, 1);
    assert.equal(s.citation_accuracy, null);
  });

  it("citation breakdown separates article and marker", () => {
    const c = scoreCitationAccuracyDetailed({
      answer: "依《政府採購法》第52條得採最有利標，並非一律最低標。",
      expectedArticles: ["第52條"],
      expectedSources: ["government-procurement-act"],
      expectFragmentMarkers: true,
      behavior: "correct",
    });
    assert.equal(c.article_hit, 1);
    assert.equal(c.source_hit, 1);
    assert.equal(c.fragment_marker, 0.5); // 有條號無 [片段N]
    assert.ok((c.score ?? 0) >= 0.7);
  });
});
