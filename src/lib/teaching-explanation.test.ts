import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTeachingExplanation,
  formatTeachingExplanation,
  hasTeachingExplanation,
  isTeachingExplanationComplete,
  parseMcOptions,
  parseTeachingExplanation,
  teachingExplanationToHintAnswer,
  TEACHING_EXPLANATION_SECTIONS,
} from "./teaching-explanation";
import { hasFullExplanation } from "./question-bank-types";
import { parseReferenceAnswer } from "./mock-exam";

describe("teaching explanation structure", () => {
  const sampleQ =
    "機關得於招標文件中規定，違反採購法第65條規定轉包者，廠商所繳納之何種比率履約保證金（含其孳息）不予發還？ (1)全部。(2)轉包部分。 (3)已完成履約部分。 (4)致部分終止或解除契約者，依該部分所占契約金額比率計算之。";

  it("parses four MC options", () => {
    const opts = parseMcOptions(sampleQ);
    assert.equal(opts.length, 4);
    assert.equal(opts[0]?.index, "1");
    assert.match(opts[0]?.text ?? "", /全部/);
  });

  it("builds all seven sections", () => {
    const parts = buildTeachingExplanation({
      question: sampleQ,
      category: "政府採購法之履約管理及驗收",
      keywords: ["轉包", "履約保證金"],
      relatedSlugs: ["government-procurement-act", "bid-bond-guarantee-operations-rules"],
      correctOption: "1",
      similarQuestions: [
        { key: "gpa-x-mc-0002", question: "另一題關於轉包與保證金 (1)a (2)b (3)c (4)d" },
      ],
    });
    assert.equal(isTeachingExplanationComplete(parts), true);
    assert.match(parts.正確答案, /選項 \(1\)/);
    assert.match(parts.法規名稱與條號, /第65條/);
    assert.match(parts.錯誤選項分析, /選項 \(2\)/);
    assert.match(parts.相似題目, /gpa-x-mc-0002/);
  });

  it("round-trips format/parse and keeps grading answer", () => {
    const hint = teachingExplanationToHintAnswer({
      question: sampleQ,
      category: "政府採購法之履約管理及驗收",
      relatedSlugs: ["government-procurement-act"],
      correctOption: "1",
    });
    assert.equal(hasTeachingExplanation(hint), true);
    assert.equal(hasFullExplanation(hint), true);
    assert.equal(parseReferenceAnswer(hint, "MULTIPLE_CHOICE"), "1");
    const parsed = parseTeachingExplanation(hint);
    assert.ok(parsed);
    assert.equal(TEACHING_EXPLANATION_SECTIONS.length, 7);
    for (const key of TEACHING_EXPLANATION_SECTIONS) {
      assert.ok(parsed![key].length > 0);
    }
  });

  it("formatTeachingExplanation includes marker headers", () => {
    const text = formatTeachingExplanation({
      正確答案: "選項 (2)",
      法規名稱與條號: "《政府採購法》第50條",
      正確理由: "理由",
      錯誤選項分析: "錯因",
      常見陷阱: "陷阱",
      官方來源: "來源",
      相似題目: "相似",
    });
    assert.equal(hasTeachingExplanation(text), true);
  });
});
