import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractConceptTags,
  isMechanicalKeyword,
  keywordsForRetrieval,
} from "./concept-tags";

describe("isMechanicalKeyword", () => {
  it("flags fixed-length truncated chunks", () => {
    assert.equal(isMechanicalKeyword("機關提供之設計圖說規"), true);
    assert.equal(isMechanicalKeyword("廠商按圖施作後實際丈"), true);
    assert.equal(isMechanicalKeyword("管理技術服務之工作內"), true);
  });

  it("keeps real concept terms", () => {
    assert.equal(isMechanicalKeyword("總價結算"), false);
    assert.equal(isMechanicalKeyword("限制性招標"), false);
    assert.equal(isMechanicalKeyword("採購評選委員會"), false);
  });
});

describe("extractConceptTags", () => {
  it("extracts semantic tags from the total-price settlement question", () => {
    const question =
      "依主管機關訂定之工程採購契約範本之內容，契約價金採「總價結算」之給付方式辦理，機關提供之設計圖說規定油漆某辦公室內側四面牆壁，契約價格詳細表標示之油漆面積為1,000平方公尺。嗣後機關辦理契約變更增加油漆天花板面積200平方公尺。廠商按圖施作後實際丈量結果牆壁油漆面積為970平方公尺、天花板油漆面積為200平方公尺。";
    const tags = extractConceptTags({
      question,
      keywords: ["機關提供之設計圖說規", "廠商按圖施作後實際丈", "總價結算"],
    });
    assert.ok(tags.includes("總價結算"));
    assert.ok(tags.includes("契約變更"));
    assert.ok(tags.includes("設計圖說") || tags.includes("契約價金"));
    assert.ok(!tags.some((t) => t.includes("設計圖說規")));
    assert.ok(!tags.some((t) => t.includes("實際丈")));
  });

  it("extracts technical service concepts", () => {
    const tags = extractConceptTags({
      question: "機關委託廠商辦理專案管理技術服務之工作內容，下列敘述何者錯誤？",
      keywords: ["管理技術服務之工作內", "機關委託廠商辦理專案"],
    });
    assert.ok(tags.includes("技術服務") || tags.includes("專案管理"));
    assert.ok(!tags.includes("管理技術服務之工作內"));
  });
});

describe("keywordsForRetrieval", () => {
  it("drops mechanical chunks from retrieval extras", () => {
    const terms = keywordsForRetrieval({
      question: "限制性招標與採購評選委員會",
      keywords: ["限制性招標", "機關提供之設計圖說規", "履約期限"],
    });
    assert.ok(terms.includes("限制性招標"));
    assert.ok(terms.includes("採購評選委員會") || terms.includes("履約期限"));
    assert.ok(!terms.includes("機關提供之設計圖說規"));
  });
});
