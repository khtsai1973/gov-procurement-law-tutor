import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("homepage chat code splitting", () => {
  it("ChatPanel does not statically import signed-in chat modules", () => {
    const src = readFileSync(new URL("./ChatPanel.tsx", import.meta.url), "utf8");
    assert.equal(src.includes("guided-prompts"), false);
    assert.equal(src.includes("prompt-suggestions"), false);
    assert.equal(src.includes("GuidedSlotForm"), false);
    assert.equal(src.includes("CitationAnswer"), false);
    assert.equal(src.includes("AnswerFeedback"), false);
    assert.equal(src.includes("starter.json"), false);
    assert.equal(src.includes("chat-panel.css"), false);
    assert.match(src, /next\/dynamic/);
    assert.match(src, /AuthenticatedChatPanel/);
  });
});
