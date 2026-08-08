import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contentToSlides,
  normalizeSlides,
  presentationFileName,
} from "@/lib/material-presentation";

describe("contentToSlides", () => {
  it("builds cover from title/category/summary", () => {
    const slides = contentToSlides({
      title: "金額門檻",
      category: "政府採購法之總則、招標及決標",
      unitCode: "U01",
      summary: "認識公告金額",
      content: "## 重點\n- A\n- B",
    });
    assert.equal(slides[0]!.title, "U01｜金額門檻");
    assert.ok(slides[0]!.bullets.includes("政府採購法之總則、招標及決標"));
    assert.ok(slides.some((s) => s.title === "重點" && s.bullets.includes("A")));
  });

  it("splits by blank paragraphs when no headings", () => {
    const slides = contentToSlides({
      title: "契約",
      category: "採購契約",
      content: "契約類型\n常見種類說明\n\n履約管理\n注意事項一\n注意事項二",
    });
    assert.ok(slides.length >= 3);
    assert.ok(slides.some((s) => s.title === "契約類型"));
    assert.ok(slides.some((s) => s.title === "履約管理"));
  });
});

describe("presentationFileName", () => {
  it("sanitizes illegal path characters", () => {
    assert.equal(presentationFileName({ title: "A/B:C", unitCode: "U1" }), "U1-A_B_C.pptx");
  });
});

describe("normalizeSlides", () => {
  it("accepts edited slide payloads", () => {
    const slides = normalizeSlides([
      { title: "封面", bullets: ["類別"], paragraphs: [] },
      { title: "  ", bullets: ["  A  ", ""], paragraphs: ["說明"] },
    ]);
    assert.equal(slides?.length, 2);
    assert.deepEqual(slides?.[1]?.bullets, ["A"]);
    assert.deepEqual(slides?.[1]?.paragraphs, ["說明"]);
  });

  it("rejects empty or invalid", () => {
    assert.equal(normalizeSlides([]), null);
    assert.equal(normalizeSlides(null), null);
    assert.equal(normalizeSlides([{ title: "", bullets: [], paragraphs: [] }]), null);
  });
});
