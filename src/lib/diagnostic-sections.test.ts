import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractWrongReasonNotes,
  parseDiagnosticSections,
} from "./diagnostic-sections";

describe("parseDiagnosticSections", () => {
  it("parses new 弱點分析 / 錯題原因分析 headers", () => {
    const sections = parseDiagnosticSections(`## 弱點分析
金額門檻與招標程序偏弱。

## 錯題原因分析
第1題：混淆公告金額與查核金額。
第2題：忽略第22條要件。

## 建議補強法規
- 《政府採購法》：複習招標方式。
`);
    assert.match(sections.weaknessAnalysis, /金額門檻/);
    assert.match(sections.wrongReasonAnalysis, /第1題/);
    assert.match(sections.regulationAdvice, /政府採購法/);
  });

  it("parses cognitive misconception sections", () => {
    const sections = parseDiagnosticSections(`## 認知誤區
把三家規則套到限制性招標。

## 適用條件差異
正確選項適用第22條第1項第9款。
錯誤選項適用公開招標第48條。

## 弱點提示
複習第22條範圍。
`);
    assert.match(sections.cognitiveMisconception, /三家/);
    assert.match(sections.applicabilityDiff, /第22條/);
    assert.match(sections.weaknessAnalysis, /複習/);
  });

  it("maps legacy headers", () => {
    const sections = parseDiagnosticSections(`## 綜合觀念診斷
綜合說明

## 弱點補強指引
【金額門檻】：複習門檻

## 逐題要點
第3題：選錯權責層級。
`);
    assert.match(sections.weaknessAnalysis, /綜合說明/);
    assert.match(sections.weaknessAnalysis, /金額門檻/);
    assert.match(sections.wrongReasonAnalysis, /第3題/);
  });
});

describe("extractWrongReasonNotes", () => {
  it("extracts per-question notes", () => {
    const map = extractWrongReasonNotes(
      `## 錯題原因分析
第1題：原因甲。
第2題：原因乙
續行說明。
`,
      [0, 1],
    );
    assert.equal(map.get(0), "原因甲。");
    assert.match(map.get(1) ?? "", /原因乙/);
  });
});
