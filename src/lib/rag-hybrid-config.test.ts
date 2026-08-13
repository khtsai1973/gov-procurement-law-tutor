import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  getRagHybridConfig,
  hybridConfigModeTag,
  RAG_HYBRID_DEFAULTS,
} from "./rag-hybrid-config";

describe("rag-hybrid-config", () => {
  const keys = [
    "RAG_DISABLE_VECTOR",
    "RAG_BM25_WEIGHT",
    "RAG_SEMANTIC_WEIGHT",
    "RAG_RRF_BLEND",
    "RAG_KEYWORD_WEIGHT",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("defaults match production hybrid weights", () => {
    const cfg = getRagHybridConfig();
    assert.equal(cfg.enableVector, true);
    assert.equal(cfg.bm25Weight, RAG_HYBRID_DEFAULTS.bm25Weight);
    assert.equal(cfg.semanticWeight, RAG_HYBRID_DEFAULTS.semanticWeight);
    assert.equal(cfg.rrfBlend, RAG_HYBRID_DEFAULTS.rrfBlend);
    assert.equal(hybridConfigModeTag(cfg), "+hybrid=bm25+vector+rrf");
  });

  it("RAG_DISABLE_VECTOR turns off dense branch", () => {
    process.env.RAG_DISABLE_VECTOR = "true";
    const cfg = getRagHybridConfig();
    assert.equal(cfg.enableVector, false);
    assert.equal(cfg.semanticWeight, 0);
    assert.equal(cfg.rrfBlend, 0);
    assert.equal(hybridConfigModeTag(cfg), "+hybrid=bm25-only");
  });

  it("reads custom weights from env", () => {
    process.env.RAG_BM25_WEIGHT = "0.4";
    process.env.RAG_SEMANTIC_WEIGHT = "0.3";
    process.env.RAG_RRF_BLEND = "0.2";
    const cfg = getRagHybridConfig();
    assert.equal(cfg.bm25Weight, 0.4);
    assert.equal(cfg.semanticWeight, 0.3);
    assert.equal(cfg.rrfBlend, 0.2);
  });
});
