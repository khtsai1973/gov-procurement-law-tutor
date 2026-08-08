import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isOfficialQuestionBankCategory } from "@/lib/question-bank-categories";
import { groupMaterialsByCategory } from "@/lib/unit-materials";

describe("isOfficialQuestionBankCategory", () => {
  it("accepts official categories", () => {
    assert.equal(isOfficialQuestionBankCategory("採購契約"), true);
    assert.equal(isOfficialQuestionBankCategory("電子採購實務"), true);
  });

  it("rejects unknown categories", () => {
    assert.equal(isOfficialQuestionBankCategory("自訂分類"), false);
    assert.equal(isOfficialQuestionBankCategory(""), false);
  });
});

describe("groupMaterialsByCategory", () => {
  it("groups in official 14-category order", () => {
    const groups = groupMaterialsByCategory([
      { id: "2", title: "B", category: "採購契約", unitCode: null },
      { id: "1", title: "A", category: "電子採購實務", unitCode: "U02" },
      { id: "3", title: "C", category: "採購契約", unitCode: "U01" },
    ]);
    assert.deepEqual(
      groups.map((g) => g.category),
      ["採購契約", "電子採購實務"],
    );
    assert.equal(groups[0]!.items.length, 2);
    assert.equal(groups[1]!.items[0]!.id, "1");
  });

  it("puts unknown categories after official ones", () => {
    const groups = groupMaterialsByCategory([
      { id: "1", title: "X", category: "其他", unitCode: null },
      { id: "2", title: "Y", category: "底價及價格分析", unitCode: null },
    ]);
    assert.deepEqual(
      groups.map((g) => g.category),
      ["底價及價格分析", "其他"],
    );
  });
});
