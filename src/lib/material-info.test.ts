import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMaterialInfoFields,
  formatLastRevisionRecord,
  materialGeneratedAt,
  materialInfoExportLines,
} from "./material-info";

describe("material info fields", () => {
  it("prefers aiGeneratedAt for generated date", () => {
    const ai = new Date("2026-08-01T10:00:00Z");
    const created = new Date("2026-07-01T10:00:00Z");
    assert.equal(materialGeneratedAt({ aiGeneratedAt: ai, createdAt: created }), ai);
    assert.equal(materialGeneratedAt({ aiGeneratedAt: null, createdAt: created }), created);
  });

  it("builds five display fields with defaults", () => {
    const info = buildMaterialInfoFields({
      createdAt: new Date("2026-08-01T02:00:00Z"),
      reviewedAt: new Date("2026-08-02T02:00:00Z"),
      reviewerName: "王老師",
      lastRevisionAt: new Date("2026-08-03T02:00:00Z"),
      lastRevisionByName: "王老師",
      lastRevisionNote: "核准後微調",
    });
    assert.match(info.regulationVersion, /法規/);
    assert.notEqual(info.generatedAt, "—");
    assert.notEqual(info.reviewedAt, "—");
    assert.equal(info.reviewer, "王老師");
    assert.match(info.lastRevision, /核准後微調/);
  });

  it("formats last revision and export lines", () => {
    assert.equal(formatLastRevisionRecord({}), "—");
    const lines = materialInfoExportLines(
      buildMaterialInfoFields({
        regulationVersion: "採購法 114 年版",
        createdAt: new Date("2026-08-01T02:00:00Z"),
        reviewerName: "李老師",
      }),
    );
    assert.equal(lines[0], "法規版本：採購法 114 年版");
    assert.equal(lines[3], "審核人員：李老師");
    assert.equal(lines.length, 5);
  });
});
