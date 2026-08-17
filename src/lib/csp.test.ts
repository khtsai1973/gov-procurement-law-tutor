import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildContentSecurityPolicy } from "./csp";

describe("CSP production policy", () => {
  const csp = buildContentSecurityPolicy({ isDev: false });

  it("drops unsafe-eval", () => {
    assert.equal(csp.includes("unsafe-eval"), false);
  });

  it("keeps unsafe-inline only for script-src / style-src (ISR inline tags)", () => {
    assert.match(csp, /script-src 'self' 'unsafe-inline'/);
    assert.match(csp, /style-src 'self' 'unsafe-inline'/);
    assert.doesNotMatch(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  });

  it("blocks inline event-handler attributes", () => {
    assert.match(csp, /script-src-attr 'none'/);
  });

  it("sets object-src none and upgrade-insecure-requests", () => {
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /upgrade-insecure-requests/);
  });
});

describe("CSP development policy", () => {
  it("allows unsafe-eval for React Fast Refresh", () => {
    const csp = buildContentSecurityPolicy({ isDev: true });
    assert.match(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
    assert.match(csp, /script-src-attr 'none'/);
  });
});
