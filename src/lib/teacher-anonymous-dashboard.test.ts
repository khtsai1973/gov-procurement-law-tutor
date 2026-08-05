import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertNoPiiKeys,
  buildScoreBuckets,
  median,
} from "@/lib/teacher-anonymous-dashboard";

describe("buildScoreBuckets", () => {
  it("bins student averages into fixed ranges", () => {
    const buckets = buildScoreBuckets([45, 60, 75, 88, 100, 59]);
    const byLabel = Object.fromEntries(buckets.map((b) => [b.label, b.count]));
    assert.equal(byLabel["0–59"], 2);
    assert.equal(byLabel["60–69"], 1);
    assert.equal(byLabel["70–79"], 1);
    assert.equal(byLabel["80–89"], 1);
    assert.equal(byLabel["90–100"], 1);
  });

  it("returns zero counts for empty input", () => {
    const buckets = buildScoreBuckets([]);
    assert.ok(buckets.every((b) => b.count === 0));
  });
});

describe("median", () => {
  it("returns null for empty", () => {
    assert.equal(median([]), null);
  });

  it("handles odd and even lengths", () => {
    assert.equal(median([10, 30, 20]), 20);
    assert.equal(median([10, 20, 30, 40]), 25);
  });
});

describe("assertNoPiiKeys", () => {
  it("accepts anonymized aggregate shapes", () => {
    assert.doesNotThrow(() =>
      assertNoPiiKeys({
        anonymized: true,
        summary: { studentCount: 3, cohortAvgScorePct: 80 },
        note: "不含 email 或 name 字串可出現在說明",
      }),
    );
  });

  it("rejects payloads with banned JSON keys", () => {
    assert.throws(
      () => assertNoPiiKeys({ email: "a@b.c" }),
      /unexpected PII key: email/,
    );
    assert.throws(
      () => assertNoPiiKeys({ nested: { userId: "x" } }),
      /unexpected PII key: userId/,
    );
    assert.throws(
      () => assertNoPiiKeys({ name: "Alice" }),
      /unexpected PII key: name/,
    );
  });
});
