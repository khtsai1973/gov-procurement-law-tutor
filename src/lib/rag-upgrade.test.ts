import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bm25Rank,
  buildBm25Index,
  reciprocalRankFusion,
  tokenizeZh,
} from "./bm25";
import {
  buildKnowledgeGraph,
  expandGraphNeighbors,
  normalizeArticleKey,
} from "./knowledge-graph";
import { localBgeStyleRerank } from "./rerank";
import { buildCitationSources, splitAnswerWithCitations } from "./citations";
import { applyRetrievalStrategy, expandHitsToParentContext } from "./rag";
import type { ChunkWithReg } from "./rag";

describe("bm25", () => {
  it("tokenizes article numbers", () => {
    const tokens = tokenizeZh("政府採購法第48條三家以上合格廠商");
    assert.ok(tokens.some((t) => t.includes("48") || t.includes("第48條")));
  });

  it("ranks keyword-matching docs higher", () => {
    const docs = [
      { id: "a", text: "公開招標應有三家以上合格廠商投標" },
      { id: "b", text: "押標金保證金作業辦法" },
    ];
    const index = buildBm25Index(docs);
    const ranked = bm25Rank(index, "三家以上合格廠商開標");
    assert.equal(ranked[0]?.id, "a");
  });

  it("fuses ranks with RRF", () => {
    const fused = reciprocalRankFusion([
      [{ id: "a" }, { id: "b" }],
      [{ id: "b" }, { id: "c" }],
    ]);
    assert.ok((fused.get("b") ?? 0) > (fused.get("a") ?? 0));
  });
});

describe("knowledge graph", () => {
  it("links 母法 and 細則 by article key", () => {
    const graph = buildKnowledgeGraph([
      {
        id: "law48",
        regulationSlug: "government-procurement-act",
        regulationTitle: "政府採購法",
        tier: "LAW",
        articleKey: "第 48 條",
        content: "### 第 48 條\n公開招標…",
      },
      {
        id: "rules48",
        regulationSlug: "gpa-enforcement-rules",
        regulationTitle: "施行細則",
        tier: "REGULATION",
        articleKey: "第 55 條",
        content: "依本法第48條，公開招標應有三家以上…",
      },
      {
        id: "interp",
        regulationSlug: "pcc-note",
        regulationTitle: "工程會函釋",
        tier: "INTERPRETATION",
        articleKey: null,
        content: "有關採購法第48條開標家數疑義…",
      },
    ]);
    assert.equal(normalizeArticleKey("第 48 條"), "第48條");
    const extras = expandGraphNeighbors(graph, ["law48"], { maxExtra: 3 });
    assert.ok(extras.some((e) => e.id === "rules48" || e.id === "interp"));
  });
});

describe("rerank + citations", () => {
  it("local BGE-style prefers article match", () => {
    const ranked = localBgeStyleRerank("採購法第22條限制性招標", [
      { id: "1", text: "無關押標金規定", semantic: 0.2, articleKey: null },
      {
        id: "2",
        text: "第22條限制性招標情形…",
        semantic: 0.25,
        articleKey: "第 22 條",
      },
    ]);
    assert.equal(ranked[0]?.id, "2");
  });

  it("splits answer citations for popover", () => {
    const segs = splitAnswerWithCitations("依 [片段1] 與[片段2]辦理。");
    assert.ok(segs.some((s) => s.kind === "cite" && s.index === 1));
    assert.ok(segs.some((s) => s.kind === "cite" && s.index === 2));
    const sources = buildCitationSources([
      {
        id: "c1",
        content: "條文原文",
        articleKey: "第 1 條",
        regulation: {
          title: "政府採購法",
          tier: "LAW",
          slug: "government-procurement-act",
          lastModifiedAt: "2024-01-01",
          sourceUrl: null,
        },
      },
    ]);
    assert.equal(sources[0]?.index, 1);
    assert.equal(sources[0]?.versionLabel, "2024-01-01");
  });
});

describe("parent-document retrieval strategy", () => {
  function fakeChunk(opts: {
    id: string;
    chunkRole: string;
    content?: string;
    parentId?: string | null;
    articleKey?: string | null;
    regulationId?: string;
    slug?: string;
    title?: string;
    tier?: string;
  }): ChunkWithReg {
    const regulationId = opts.regulationId ?? "reg1";
    return {
      id: opts.id,
      content: opts.content ?? "content",
      embedding: null,
      regulationId,
      chunkIndex: 0,
      chunkRole: opts.chunkRole,
      parentId: opts.parentId ?? null,
      articleKey: opts.articleKey ?? "第 48 條",
      createdAt: new Date(),
      regulation: {
        id: regulationId,
        slug: opts.slug ?? "government-procurement-act",
        title: opts.title ?? "政府採購法",
        tier: (opts.tier ?? "LAW") as ChunkWithReg["regulation"]["tier"],
        sortOrder: 0,
        sourceUrl: null,
        notes: null,
        lastModifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as unknown as ChunkWithReg;
  }

  it("expands child hits to parent context", () => {
    const parent = fakeChunk({
      id: "p1",
      chunkRole: "PARENT",
      content: "### 第 48 條\n完整條文上下文",
    });
    const child = fakeChunk({
      id: "c1",
      chunkRole: "CHILD",
      parentId: "p1",
      content: "【檢索單元】三家以上",
    });
    const byId = new Map([
      [parent.id, parent],
      [child.id, child],
    ]);
    const expanded = expandHitsToParentContext([child], byId);
    assert.equal(expanded[0]?.id, "p1");
    assert.match(expanded[0]!.content, /完整條文/);
  });

  it("parent_contextual strategy tags include parent-child", () => {
    const parent = fakeChunk({ id: "p1", chunkRole: "PARENT", content: "母法全文" });
    const child = fakeChunk({
      id: "c1",
      chunkRole: "CHILD",
      parentId: "p1",
      content: "child",
    });
    const byId = new Map([
      [parent.id, parent],
      [child.id, child],
    ]);
    const applied = applyRetrievalStrategy({
      strategy: "parent_contextual",
      childHits: [child],
      byId,
      allChunks: [parent, child],
      hasHierarchy: true,
      topK: 4,
      enableGraph: false,
    });
    assert.ok(applied.strategyTags.includes("+parent-child"));
    assert.equal(applied.chunks[0]?.id, "p1");
  });

  it("baseline keeps child without parent expand", () => {
    const parent = fakeChunk({ id: "p1", chunkRole: "PARENT", content: "母法全文" });
    const child = fakeChunk({
      id: "c1",
      chunkRole: "CHILD",
      parentId: "p1",
      content: "child",
    });
    const byId = new Map([
      [parent.id, parent],
      [child.id, child],
    ]);
    const applied = applyRetrievalStrategy({
      strategy: "baseline",
      childHits: [child],
      byId,
      allChunks: [parent, child],
      hasHierarchy: true,
      topK: 4,
    });
    assert.equal(applied.chunks[0]?.id, "c1");
    assert.ok(applied.strategyTags.some((t) => t.includes("baseline")));
  });
});
