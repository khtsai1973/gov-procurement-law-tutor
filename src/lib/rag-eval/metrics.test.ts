import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  scoreAnswerRelevance,
  scoreContextRecall,
  scoreFaithfulness,
} from "@/lib/rag-eval/metrics";
import { produceOfflineAnswer, runOfflineRagEval, scoreCase } from "@/lib/rag-eval/run";
import type { RagEvalCase } from "@/lib/rag-eval/types";

describe("rag-eval metrics", () => {
  it("scores high faithfulness when answer sticks to context facts", () => {
    const score = scoreFaithfulness({
      answer: "查核金額工程及財物 5000 萬，勞務 1000 萬；公告金額 150 萬。",
      contexts: ["查核金額：工程及財物 5000 萬；勞務 1000 萬。公告金額 150 萬。"],
      mustInclude: ["5000", "150", "查核", "公告"],
    });
    assert.ok(score >= 0.85, `got ${score}`);
  });

  it("penalizes hallucinated amounts not in context", () => {
    const score = scoreFaithfulness({
      answer: "查核金額為 9999 萬元，公告金額為 1 元。",
      contexts: ["查核金額：工程及財物 5000 萬；公告金額 150 萬。"],
      mustInclude: ["5000", "150"],
    });
    assert.ok(score < 0.5, `got ${score}`);
  });

  it("scores answer relevance for on-topic answers", () => {
    const score = scoreAnswerRelevance({
      question: "中央機關小額採購金額門檻是多少？",
      answer: "中央機關小額採購門檻為 15 萬元以下。",
      relevanceKeywords: ["小額採購", "門檻"],
    });
    assert.ok(score >= 0.9);
  });

  it("scores off-topic refusal as relevant for off-topic questions", () => {
    const score = scoreAnswerRelevance({
      question: "今天天氣如何？",
      answer: "非本主題的範圍",
    });
    assert.equal(score, 1);
  });

  it("scores context recall", () => {
    const recall = scoreContextRecall({
      contexts: ["三家以上合格廠商之公開招標"],
      mustInclude: ["三家", "公開招標"],
    });
    assert.equal(recall, 1);
  });
});

describe("rag-eval offline suite", () => {
  it("produces deterministic answers for threshold case", () => {
    const c: RagEvalCase = {
      id: "t",
      question: "今年的查核金額、公告金額各是多少？",
      contexts: ["查核 5000 公告 150"],
      must_include: ["5000", "150"],
      relevance_keywords: ["查核金額", "公告金額"],
      kind: "deterministic",
    };
    const { answer, model } = produceOfflineAnswer(c);
    assert.match(answer, /150/);
    assert.equal(model, "current-threshold-figures");
    const s = scoreCase({ case: c, answer, contexts: c.contexts });
    assert.ok(s.faithfulness >= 0.7);
    assert.ok(s.answer_relevance >= 0.7);
  });

  it("full offline suite passes thresholds", async () => {
    const report = await runOfflineRagEval();
    assert.ok(report.summary.n >= 5);
    assert.equal(report.summary.pass, true);
    assert.ok(report.summary.faithfulness_mean >= 0.7);
    assert.ok(report.summary.answer_relevance_mean >= 0.7);
  });
});
