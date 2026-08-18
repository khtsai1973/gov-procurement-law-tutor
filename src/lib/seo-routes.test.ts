import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PUBLIC_SITEMAP_PATHS, ROBOTS_DISALLOW_PATHS, absoluteUrl } from "./seo-routes";

describe("seo public routes", () => {
  it("lists public pages and excludes admin/auth", () => {
    assert.ok(PUBLIC_SITEMAP_PATHS.includes("/"));
    assert.ok(PUBLIC_SITEMAP_PATHS.includes("/privacy"));
    assert.ok(PUBLIC_SITEMAP_PATHS.includes("/question-bank"));
    assert.equal(
      PUBLIC_SITEMAP_PATHS.some((p) => p.startsWith("/admin") || p.startsWith("/teacher")),
      false,
    );
  });

  it("disallows private prefixes in robots", () => {
    assert.ok(ROBOTS_DISALLOW_PATHS.includes("/admin"));
    assert.ok(ROBOTS_DISALLOW_PATHS.includes("/api/"));
    assert.ok(ROBOTS_DISALLOW_PATHS.includes("/dashboard"));
  });

  it("builds absolute urls without double slash", () => {
    assert.equal(absoluteUrl("https://example.com", "/"), "https://example.com");
    assert.equal(absoluteUrl("https://example.com/", "/privacy"), "https://example.com/privacy");
  });
});
