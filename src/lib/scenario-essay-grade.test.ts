import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getScenarioEssayQuestion,
  listScenarioEssayQuestions,
  SCENARIO_ESSAY_QUESTIONS,
} from "./scenario-essay-bank";
import {
  buildFallbackGrade,
  extractJsonObject,
  normalizeGradePayload,
  SCENARIO_ESSAY_GRADING_SYSTEM,
} from "./scenario-essay-grade";
import { RUBRIC_WEIGHTS } from "./scenario-essay-types";

describe("scenario essay bank", () => {
  it("includes the Art.63 overdue labor scenario", () => {
    const q = getScenarioEssayQuestion("se-art63-overdue-labor");
    assert.ok(q);
    assert.match(q!.prompt, /第\s*63\s*條/);
    assert.match(q!.prompt, /逾期/);
    assert.ok(q!.rubricFocus.mustCover.length >= 2);
  });

  it("lists questions without leaking rubricFocus", () => {
    const list = listScenarioEssayQuestions();
    assert.equal(list.length, SCENARIO_ESSAY_QUESTIONS.length);
    assert.ok(list.every((q) => q.title && q.prompt && !("rubricFocus" in q)));
  });
});

describe("rubric grading helpers", () => {
  it("system prompt encodes 30/40/30 weights and JSON fields", () => {
    assert.match(SCENARIO_ESSAY_GRADING_SYSTEM, /30%/);
    assert.match(SCENARIO_ESSAY_GRADING_SYSTEM, /40%/);
    assert.match(SCENARIO_ESSAY_GRADING_SYSTEM, /deductions/);
    assert.match(SCENARIO_ESSAY_GRADING_SYSTEM, /modelAnswer/);
    assert.equal(RUBRIC_WEIGHTS.citation, 30);
    assert.equal(RUBRIC_WEIGHTS.procedure, 40);
    assert.equal(RUBRIC_WEIGHTS.coherence, 30);
  });

  it("extracts JSON from raw or fenced content", () => {
    const raw = extractJsonObject(`{"total":70,"deductions":["a"],"strengths":["b"]}`);
    assert.deepEqual(raw, { total: 70, deductions: ["a"], strengths: ["b"] });

    const fenced = extractJsonObject(`\`\`\`json\n{"total":55}\n\`\`\``);
    assert.deepEqual(fenced, { total: 55 });
  });

  it("normalizes scores within rubric caps and reconciles total", () => {
    const q = getScenarioEssayQuestion("se-art63-overdue-labor")!;
    const normalized = normalizeGradePayload(
      {
        scores: {
          citation: { score: 99, max: 30, comment: "ok" },
          procedure: { score: 20, comment: "proc" },
          coherence: { score: 15, comment: "coh" },
        },
        total: 10,
        deductions: ["缺契約對照"],
        strengths: ["有提第63條"],
        modelAnswer: "示範全文",
      },
      q,
    );
    assert.equal(normalized.scores.citation.score, 30);
    assert.equal(normalized.scores.procedure.score, 20);
    assert.equal(normalized.scores.coherence.score, 15);
    assert.equal(normalized.total, 65);
    assert.equal(normalized.modelAnswer, "示範全文");
    assert.ok(normalized.deductions.includes("缺契約對照"));
  });

  it("fallback grade returns zeros for empty answer and outline model answer", () => {
    const q = getScenarioEssayQuestion("se-art63-overdue-labor")!;
    const empty = buildFallbackGrade(q, "");
    assert.equal(empty.total, 0);
    assert.ok(empty.deductions.includes("空白作答"));
    assert.match(empty.modelAnswer, /第63條/);

    const filled = buildFallbackGrade(
      q,
      "本機關茲依政府採購法第63條及契約逾期違約金規定，確認廠商履約逾期十日屬可歸責後，依約計算違約金並通知扣抵價金；如經催告仍不履行，得終止契約並請求損害賠償。謹陳核。",
    );
    assert.ok(filled.total > 0);
    assert.ok(filled.total <= 100);
    assert.equal(
      filled.total,
      filled.scores.citation.score +
        filled.scores.procedure.score +
        filled.scores.coherence.score,
    );
  });
});
