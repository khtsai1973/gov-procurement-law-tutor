import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CHUNKING,
  chunkMarkdownForRag,
  chunkMarkdownParentChild,
} from "@/lib/chunk-text";
import {
  enrichWithRelatedEnforcementParents,
  expandHitsToParentContext,
  formatRagContext,
  type ChunkWithReg,
} from "@/lib/rag";

const sampleLaw = `# 測試法

### 第 1 條

為建立制度，制定本法。內容需足夠長以便切成多個 child。${"甲".repeat(400)}

### 第 2 條

主管機關為工程會。${"乙".repeat(100)}
`;

function fakeChunk(partial: Partial<ChunkWithReg> & { id: string; content: string }): ChunkWithReg {
  return {
    id: partial.id,
    regulationId: partial.regulationId ?? "reg1",
    content: partial.content,
    chunkIndex: partial.chunkIndex ?? 0,
    embedding: partial.embedding ?? null,
    chunkRole: partial.chunkRole ?? "CHILD",
    parentId: partial.parentId ?? null,
    articleKey: partial.articleKey ?? null,
    createdAt: new Date(),
    regulation: partial.regulation ?? {
      id: "reg1",
      slug: "government-procurement-act",
      title: "政府採購法",
      tier: "LAW",
      sortOrder: 0,
      lastModifiedAt: null,
      sourceUrl: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe("parent-child chunking", () => {
  it("splits articles into parent units with smaller children", () => {
    const plan = chunkMarkdownParentChild(sampleLaw, "政府採購法");
    assert.ok(plan.units.length >= 2);
    const u1 = plan.units[0]!;
    assert.equal(u1.articleKey, "第 1 條");
    assert.match(u1.parentContent, /第 1 條/);
    assert.ok(u1.children.length >= 1);
    assert.ok(u1.children[0]!.includes("【檢索單元】"));
    assert.ok(u1.children[0]!.includes("第 1 條"));
    assert.ok(u1.parentContent.length <= CHUNKING.PARENT_MAX_CHARS);
    for (const c of u1.children) {
      // contextual prefix + body may exceed CHILD_MAX slightly; body slices respect max
      assert.ok(c.length > 0);
    }
  });

  it("flat chunkMarkdownForRag returns parent-sized articles", () => {
    const flat = chunkMarkdownForRag(sampleLaw, "政府採購法");
    assert.ok(flat.length >= 2);
    assert.match(flat[0]!, /第 1 條/);
  });
});

describe("parent expansion + contextual enforcement", () => {
  it("expands child hits to parent context", () => {
    const parent = fakeChunk({
      id: "p1",
      content: "### 第 48 條\n三家以上合格廠商…",
      chunkRole: "PARENT",
      articleKey: "第 48 條",
    });
    const child = fakeChunk({
      id: "c1",
      content: "【檢索單元】｜條號：第 48 條\n三家",
      chunkRole: "CHILD",
      parentId: "p1",
      articleKey: "第 48 條",
    });
    const byId = new Map([
      [parent.id, parent],
      [child.id, child],
    ]);
    const expanded = expandHitsToParentContext([child], byId);
    assert.equal(expanded.length, 1);
    assert.equal(expanded[0]!.id, "p1");
    assert.equal(expanded[0]!.chunkRole, "PARENT");
  });

  it("attaches related enforcement parent when GPA article hits", () => {
    const gpa = fakeChunk({
      id: "p-gpa",
      content: "### 第 48 條\n公開招標…",
      chunkRole: "PARENT",
      articleKey: "第 48 條",
    });
    const enf = fakeChunk({
      id: "p-enf",
      content: "### 第 55 條\n本法第 48 條所稱三家以上合格廠商…",
      chunkRole: "PARENT",
      articleKey: "第 55 條",
      regulation: {
        id: "reg2",
        slug: "gpa-enforcement-rules",
        title: "政府採購法施行細則",
        tier: "REGULATION",
        sortOrder: 1,
        lastModifiedAt: null,
        sourceUrl: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const enriched = enrichWithRelatedEnforcementParents([gpa], [gpa, enf], 2);
    assert.ok(enriched.some((c) => c.id === "p-enf"));
  });

  it("formatRagContext labels parent as 完整條文", () => {
    const parent = fakeChunk({
      id: "p1",
      content: "### 第 1 條\n為建立…",
      chunkRole: "PARENT",
      articleKey: "第 1 條",
    });
    const text = formatRagContext([parent]);
    assert.match(text, /完整條文/);
    assert.match(text, /第 1 條/);
  });
});
