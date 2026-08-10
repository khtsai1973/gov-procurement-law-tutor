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
