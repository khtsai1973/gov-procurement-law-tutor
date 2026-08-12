import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  scoreCitationAccuracy,
  scoreRetrievalHitRate,
  latencySummary,
} from "./compare-metrics";
import { parseStrategies, summarizeStrategy, type CompareCaseRow } from "./compare";
import { applyRetrievalStrategy, type ChunkWithReg } from "@/lib/rag";

function chunk(
  partial: Partial<ChunkWithReg> & {
    id: string;
    slug: string;
    title?: string;
    tier?: string;
  },
): ChunkWithReg {
  return {
    id: partial.id,
    parentId: partial.parentId ?? null,
    chunkRole: partial.chunkRole ?? "CHILD",
    articleKey: partial.articleKey ?? null,
    content: partial.content ?? "",
    regulation: {
      id: `r-${partial.slug}`,
      slug: partial.slug,
      title: partial.title ?? partial.slug,
      tier: partial.tier ?? "LAW",
    },
  } as ChunkWithReg;
}

describe("compare-metrics", () => {
  it("scores citation and retrieval hit rate", () => {
    assert.equal(scoreCitationAccuracy("依第48條應有三家", ["第48條"]), 1);
    assert.equal(
      scoreRetrievalHitRate({
        retrieved: [{ slug: "government-procurement-act", articleKey: "第 48 條", content: "三家" }],
        expectedSources: ["government-procurement-act"],
        expectedArticles: ["第48條"],
      }),
      1,
    );
    const lat = latencySummary([10, 20, 30, 40, 100]);
    assert.equal(lat.n, 5);
    assert.ok(lat.p50 != null && lat.p95 != null);
  });

  it("parses strategies", () => {
    assert.deepEqual(parseStrategies("baseline,contextual"), ["baseline", "contextual"]);
    assert.equal(parseStrategies("").length, 3);
  });
});

describe("applyRetrievalStrategy", () => {
  const parent = chunk({
    id: "p1",
    slug: "government-procurement-act",
    chunkRole: "PARENT",
    articleKey: "第 48 條",
    content: "### 第 48 條\n三家以上合格廠商",
    title: "政府採購法",
  });
  const child = chunk({
    id: "c1",
    parentId: "p1",
    slug: "government-procurement-act",
    chunkRole: "CHILD",
    articleKey: "第 48 條",
    content: "child 三家",
    title: "政府採購法",
  });
  const enf = chunk({
    id: "e1",
    slug: "gpa-enforcement-rules",
    chunkRole: "PARENT",
    articleKey: "第 55 條",
    content: "### 第 55 條\n本法第48條所稱三家以上合格廠商，係指公開招標。",
    title: "施行細則",
    tier: "REGULATION",
  });
  const all = [parent, child, enf];
  const byId = new Map(all.map((c) => [c.id, c]));

  it("baseline returns children only", () => {
    const r = applyRetrievalStrategy({
      strategy: "baseline",
      childHits: [child],
      byId,
      allChunks: all,
      hasHierarchy: true,
      topK: 8,
    });
    assert.deepEqual(
      r.chunks.map((c) => c.id),
      ["c1"],
    );
    assert.ok(r.strategyTags.some((t) => t.includes("baseline")));
  });

  it("contextual may attach enforcement parent", () => {
    const r = applyRetrievalStrategy({
      strategy: "contextual",
      childHits: [child],
      byId,
      allChunks: all,
      hasHierarchy: true,
      topK: 8,
    });
    assert.ok(r.chunks.some((c) => c.id === "c1"));
    assert.ok(r.chunks.some((c) => c.id === "e1"), "should enrich enforcement");
    assert.ok(!r.chunks.some((c) => c.id === "p1"), "should not expand GPA parent");
  });

  it("parent_contextual expands to parent", () => {
    const r = applyRetrievalStrategy({
      strategy: "parent_contextual",
      childHits: [child],
      byId,
      allChunks: all,
      hasHierarchy: true,
      topK: 8,
      enableGraph: false,
    });
    assert.ok(r.chunks.some((c) => c.id === "p1"));
    assert.ok(r.strategyTags.some((t) => t.includes("parent_contextual")));
  });
});

describe("summarizeStrategy", () => {
  it("aggregates rows", () => {
    const rows: CompareCaseRow[] = [
      {
        id: "G001",
        strategy: "baseline",
        retrieval_hit_rate: 0.5,
        citation_accuracy: null,
        faithfulness: null,
        answer_relevance: null,
        refuse_ok: null,
        latency_ms: 12,
        chunk_count: 2,
      },
      {
        id: "G002",
        strategy: "baseline",
        retrieval_hit_rate: 1,
        citation_accuracy: null,
        faithfulness: null,
        answer_relevance: null,
        refuse_ok: null,
        latency_ms: 20,
        chunk_count: 3,
      },
    ];
    const s = summarizeStrategy("baseline", rows);
    assert.equal(s.n, 2);
    assert.equal(s.retrieval_hit_rate_mean, 0.75);
  });
});
