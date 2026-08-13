import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeKnowledgeRadar } from "@/lib/knowledge-radar";
import {
  buildPersonalWeaknessReport,
  parseDiagnosisBundle,
  pickPracticeQuestionsByTags,
  stringifyDiagnosisBundle,
} from "@/lib/personal-weakness-report";

describe("personal weakness report", () => {
  it("builds core strengths and key weaknesses from radar", () => {
    const radar = computeKnowledgeRadar([
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] },
      { revealed: true, isCorrect: true, tags: ["招標程序"] }, // 100%
      { revealed: true, isCorrect: false, tags: ["爭議處理"] },
      { revealed: true, isCorrect: false, tags: ["爭議處理"] },
      { revealed: true, isCorrect: true, tags: ["爭議處理"] }, // 33%
    ]);
    const report = buildPersonalWeaknessReport({
      radar,
      wrongConceptTags: ["異議", "第22條第1項第7款"],
      regulations: [
        { slug: "a", title: "甲法", sourceUrl: null },
        { slug: "b", title: "乙法", sourceUrl: null },
        { slug: "c", title: "丙法", sourceUrl: null },
        { slug: "d", title: "丁法", sourceUrl: null },
      ],
      practiceQuestions: [
        { key: "q1", category: "爭議", question: "題一", tags: ["異議"] },
        { key: "q2", category: "爭議", question: "題二", tags: ["申訴"] },
        { key: "q3", category: "爭議", question: "題三", tags: ["調解"] },
      ],
    });
    assert.equal(report.title, "個人化學習弱點診斷書");
    assert.ok(report.coreStrengths.some((s) => s.includes("招標程序") && s.includes("100%")));
    assert.ok(report.keyWeaknesses.some((s) => s.includes("爭議處理")));
    assert.ok(report.keyWeaknesses.includes("異議") || report.keyWeaknesses.includes("第22條第1項第7款"));
    assert.equal(report.regulationLinks.length, 3);
    assert.equal(report.practiceQuestions.length, 2);
  });

  it("picks practice questions by overlapping weak tags", () => {
    const picked = pickPracticeQuestionsByTags({
      weakTags: ["爭議處理", "異議"],
      excludeKeys: new Set(["skip"]),
      candidates: [
        {
          key: "skip",
          category: "政府採購法之爭議處理",
          question: "異議期限？",
          knowledgeTags: ["爭議處理"],
        },
        {
          key: "keep1",
          category: "政府採購法之爭議處理",
          question: "廠商提出異議之期限如何計算？",
          knowledgeTags: ["爭議處理"],
        },
        {
          key: "keep2",
          category: "政府採購法之爭議處理",
          question: "申訴與異議差異？",
          keywords: ["異議", "申訴"],
        },
        {
          key: "other",
          category: "電子採購實務",
          question: "電子領標流程？",
          knowledgeTags: ["電子採購"],
        },
      ],
      limit: 2,
    });
    assert.equal(picked.length, 2);
    assert.ok(picked.every((p) => p.key !== "skip" && p.key !== "other"));
  });

  it("parses legacy recommendations array and new bundle", () => {
    const legacy = parseDiagnosisBundle(
      JSON.stringify([{ slug: "gpa", title: "政府採購法", sourceUrl: null }]),
    );
    assert.equal(legacy.regulations.length, 1);
    assert.equal(legacy.practiceQuestions.length, 0);

    const raw = stringifyDiagnosisBundle({
      regulations: [{ slug: "gpa", title: "政府採購法", sourceUrl: null, reason: "複習" }],
      practiceQuestions: [{ key: "k1", category: "c", question: "q", tags: ["金額門檻"] }],
    });
    const bundle = parseDiagnosisBundle(raw);
    assert.equal(bundle.regulations[0]?.slug, "gpa");
    assert.equal(bundle.practiceQuestions[0]?.key, "k1");
  });
});
