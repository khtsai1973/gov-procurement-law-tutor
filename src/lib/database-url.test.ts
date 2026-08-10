import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { withServerlessDbParams } from "./database-url";

describe("withServerlessDbParams", () => {
  it("adds connect_timeout and connection_limit when missing", () => {
    const out = withServerlessDbParams(
      "postgresql://u:p@ep-xxx.aws.neon.tech/db?sslmode=require",
    );
    assert.ok(out?.includes("connect_timeout=10"));
    assert.ok(out?.includes("connection_limit=5"));
    assert.ok(out?.includes("sslmode=require"));
  });

  it("does not override existing params", () => {
    const out = withServerlessDbParams(
      "postgresql://u:p@localhost:5432/db?connection_limit=1&connect_timeout=3",
    );
    assert.ok(out?.includes("connection_limit=1"));
    assert.ok(out?.includes("connect_timeout=3"));
    assert.equal(out?.includes("connection_limit=5"), false);
  });
});
