import assert from "node:assert/strict";

import { parseFrontmatter, slugifyNotebookLm } from "../../src/lib/notebooklm-import";

assert.equal(slugifyNotebookLm("採購法重點.md"), "notebooklm-採購法重點");
assert.equal(slugifyNotebookLm("notebooklm-already"), "notebooklm-already");

const parsed = parseFrontmatter(`---
title: 測試筆記
slug: notebooklm-test
tier: INTERPRETATION
---

正文內容`);
assert.equal(parsed.meta.title, "測試筆記");
assert.equal(parsed.body, "正文內容");

console.log("notebooklm-import.test.ts OK");
