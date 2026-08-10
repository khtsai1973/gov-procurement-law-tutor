import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMaterialDocx,
  buildMaterialPdf,
  contentToDocumentBlocks,
  documentFileName,
} from "./material-document";

describe("documentFileName", () => {
  it("sanitizes and appends extension", () => {
    assert.equal(documentFileName({ title: "A/B:C", unitCode: "U1" }, "docx"), "U1-A_B_C.docx");
    assert.equal(documentFileName({ title: "A/B:C", unitCode: "U1" }, "pdf"), "U1-A_B_C.pdf");
  });
});

describe("contentToDocumentBlocks", () => {
  it("parses headings bullets and paragraphs", () => {
    const blocks = contentToDocumentBlocks(
      "## 重點\n- 第一點\n- 第二點\n說明段落\n### 細節\n1. 編號項",
    );
    assert.deepEqual(blocks[0], { kind: "heading", level: 2, text: "重點" });
    assert.ok(blocks.some((b) => b.kind === "bullet" && b.text === "第一點"));
    assert.ok(blocks.some((b) => b.kind === "paragraph" && b.text === "說明段落"));
    assert.ok(blocks.some((b) => b.kind === "heading" && b.level === 3 && b.text === "細節"));
    assert.ok(blocks.some((b) => b.kind === "bullet" && b.text === "編號項"));
  });

  it("returns empty for blank content", () => {
    assert.deepEqual(contentToDocumentBlocks("  \n\n"), []);
  });
});

describe("buildMaterialDocx/Pdf", () => {
  const sample = {
    title: "金額門檻",
    category: "政府採購法之總則、招標及決標",
    unitCode: "U01",
    summary: "認識公告金額",
    content: "## 重點\n- 公告金額\n- 小額採購\n\n正文說明一段。",
    info: {
      regulationVersion: "採購法 114 年版",
      generatedAt: "2026/8/1 上午10:00",
      reviewedAt: "2026/8/2 上午11:00",
      reviewer: "王老師",
      lastRevision: "2026/8/3 下午2:00 · 王老師 · 微調",
    },
  };

  it("builds a non-empty docx buffer", async () => {
    const buf = await buildMaterialDocx(sample);
    assert.ok(buf.byteLength > 1000);
    // ZIP/OOXML signature
    assert.equal(buf[0], 0x50);
    assert.equal(buf[1], 0x4b);
  });

  it("builds a non-empty pdf buffer with Chinese", async () => {
    const buf = await buildMaterialPdf(sample);
    assert.ok(buf.byteLength > 1000);
    assert.equal(buf.subarray(0, 5).toString("utf8"), "%PDF-");
  });
});
