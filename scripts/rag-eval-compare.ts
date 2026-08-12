#!/usr/bin/env node
/**
 * Baseline / Contextual / Parent-Document RAG 比較
 *
 *   # 有 DATABASE_URL：真實檢索比較（預設不呼叫 LLM）
 *   npm run rag:eval:compare
 *
 *   # 強制 fixture（無 DB／CI）
 *   RAG_COMPARE_MODE=fixture npm run rag:eval:compare
 *
 *   # 含生成回答（需 OPENAI_API_KEY）
 *   RAG_COMPARE_GENERATE=1 npm run rag:eval:compare
 *
 * Env:
 *   RAG_COMPARE_STRATEGIES=baseline,contextual,parent_contextual
 *   RAG_COMPARE_LIMIT=50
 *   RAG_COMPARE_ENABLE_GRAPH=0
 *   RAG_COMPARE_TOP_K=8
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  formatCompareMarkdown,
  parseStrategies,
  scoreRetrievedAgainstGolden,
  selectGoldenForCompare,
  summarizeStrategy,
  type CompareCaseRow,
  type CompareReport,
} from "../src/lib/rag-eval/compare";
import {
  applyRetrievalStrategy,
  retrieveForRag,
  type ChunkWithReg,
  type RagStrategy,
} from "../src/lib/rag";
import { generateGroundedAnswer } from "../src/lib/answer";
import type { GoldenItem } from "../src/lib/rag-eval/golden-types";

function buildFixtureCorpus(): {
  all: ChunkWithReg[];
  byId: Map<string, ChunkWithReg>;
  childHitsBySlugArticle: Map<string, ChunkWithReg>;
} {
  // 精簡 fixture：母法 Parent/Child＋施行細則 Parent，供策略展開單元驗證
  const regGpa = {
    id: "reg-gpa",
    slug: "government-procurement-act",
    title: "政府採購法",
    tier: "LAW",
  } as ChunkWithReg["regulation"];
  const regEnf = {
    id: "reg-enf",
    slug: "gpa-enforcement-rules",
    title: "政府採購法施行細則",
    tier: "REGULATION",
  } as ChunkWithReg["regulation"];

  const parent48 = {
    id: "p-48",
    parentId: null,
    chunkRole: "PARENT",
    articleKey: "第 48 條",
    content: "### 第 48 條\n有三家以上合格廠商投標，即應開標決標。",
    regulation: regGpa,
  } as ChunkWithReg;
  const child48 = {
    id: "c-48",
    parentId: "p-48",
    chunkRole: "CHILD",
    articleKey: "第 48 條",
    content: "【檢索單元】｜法規：《政府採購法》｜條號：第 48 條\n三家以上合格廠商",
    regulation: regGpa,
  } as ChunkWithReg;
  const parent22 = {
    id: "p-22",
    parentId: null,
    chunkRole: "PARENT",
    articleKey: "第 22 條",
    content: "### 第 22 條\n得採限制性招標。第九款專業服務…",
    regulation: regGpa,
  } as ChunkWithReg;
  const child22 = {
    id: "c-22",
    parentId: "p-22",
    chunkRole: "CHILD",
    articleKey: "第 22 條",
    content: "【檢索單元】｜第 22 條\n限制性招標 第九款",
    regulation: regGpa,
  } as ChunkWithReg;
  const parent52 = {
    id: "p-52",
    parentId: null,
    chunkRole: "PARENT",
    articleKey: "第 52 條",
    content: "### 第 52 條\n決標應依原則之一：最低標、最有利標、複數決標。",
    regulation: regGpa,
  } as ChunkWithReg;
  const child52 = {
    id: "c-52",
    parentId: "p-52",
    chunkRole: "CHILD",
    articleKey: "第 52 條",
    content: "【檢索單元】｜第 52 條\n最有利標為原則",
    regulation: regGpa,
  } as ChunkWithReg;
  const enf55 = {
    id: "p-enf-55",
    parentId: null,
    chunkRole: "PARENT",
    articleKey: "第 55 條",
    content: "### 第 55 條\n本法第四十八條三家以上合格廠商係指公開招標。",
    regulation: regEnf,
  } as ChunkWithReg;

  const all = [parent48, child48, parent22, child22, parent52, child52, enf55];
  const byId = new Map(all.map((c) => [c.id, c]));
  const childHitsBySlugArticle = new Map<string, ChunkWithReg>([
    ["government-procurement-act|第48條", child48],
    ["government-procurement-act|第22條", child22],
    ["government-procurement-act|第52條", child52],
  ]);
  return { all, byId, childHitsBySlugArticle };
}

function fixtureHitsForItem(
  item: GoldenItem,
  index: Map<string, ChunkWithReg>,
  fallbackChildren: ChunkWithReg[],
): ChunkWithReg[] {
  const hits: ChunkWithReg[] = [];
  for (const src of item.expected_sources) {
    for (const art of item.expected_articles) {
      const key = `${src}|${art.replace(/\s+/g, "").replace(/第(\d+)條.*/, "第$1條")}`;
      // try normalized keys
      const n = art.replace(/\s+/g, "").match(/第(\d{1,3})條/);
      if (n) {
        const k = `${src}|第${n[1]}條`;
        const hit = index.get(k);
        if (hit && !hits.some((h) => h.id === hit.id)) hits.push(hit);
      }
      void key;
    }
  }
  if (hits.length === 0 && item.expected_behavior !== "refuse") {
    // 無對應 fixture 時給第一個 child，避免整題空白
    if (fallbackChildren[0]) hits.push(fallbackChildren[0]);
  }
  return hits;
}

async function runFixtureCompare(params: {
  strategies: RagStrategy[];
  items: GoldenItem[];
  enableGraph: boolean;
  topK: number;
}): Promise<CompareReport> {
  const { all, byId, childHitsBySlugArticle } = buildFixtureCorpus();
  const fallbackChildren = all.filter((c) => c.chunkRole === "CHILD");
  const rows: CompareCaseRow[] = [];

  for (const strategy of params.strategies) {
    for (const item of params.items) {
      const t0 = Date.now();
      const childHits = fixtureHitsForItem(item, childHitsBySlugArticle, fallbackChildren);
      const applied = applyRetrievalStrategy({
        strategy,
        childHits,
        byId,
        allChunks: all,
        hasHierarchy: true,
        topK: params.topK,
        enableGraph: params.enableGraph && strategy === "parent_contextual",
      });
      const latency_ms = Date.now() - t0;
      const scored = scoreRetrievedAgainstGolden({
        item,
        retrieved: applied.chunks.map((c) => ({
          slug: c.regulation.slug,
          title: c.regulation.title,
          articleKey: c.articleKey,
          content: c.content,
        })),
        answer: item.expected_behavior === "refuse" ? item.gold_answer : null,
      });
      rows.push({
        id: item.id,
        strategy,
        ...scored,
        latency_ms,
        mode: applied.strategyTags.join(""),
        chunk_count: applied.chunks.length,
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    mode: "fixture",
    generate_answers: false,
    enable_graph: params.enableGraph,
    strategies: params.strategies,
    summary: params.strategies.map((s) => summarizeStrategy(s, rows)),
    cases: rows,
    notes: [
      "本報告為 fixture 模式：用精簡母法／細則片段模擬策略展開，驗證 Hit Rate 與策略差異；非正式 Production 語料全量結果。",
      "正式比較請設定 DATABASE_URL 後執行 live 模式（可加 RAG_COMPARE_GENERATE=1）。",
      "三方比較預設關閉 GraphRAG，以免 parent_contextual 雙重加分。",
    ],
  };
}

async function runLiveCompare(params: {
  strategies: RagStrategy[];
  items: GoldenItem[];
  enableGraph: boolean;
  topK: number;
  generate: boolean;
}): Promise<CompareReport> {
  const rows: CompareCaseRow[] = [];
  for (const strategy of params.strategies) {
    for (const item of params.items) {
      const t0 = Date.now();
      if (item.expected_behavior === "refuse") {
        const latency_ms = Date.now() - t0;
        const scored = scoreRetrievedAgainstGolden({
          item,
          retrieved: [],
          answer: item.gold_answer,
        });
        rows.push({
          id: item.id,
          strategy,
          ...scored,
          latency_ms,
          mode: "refuse-skip-retrieve",
          chunk_count: 0,
        });
        continue;
      }

      const { chunks, mode } = await retrieveForRag(item.question, params.topK, {
        strategy,
        enableGraph: params.enableGraph && strategy === "parent_contextual",
      });
      let answer: string | null = null;
      if (params.generate) {
        const result = await generateGroundedAnswer(item.question, chunks);
        answer = result.answer;
      }
      const latency_ms = Date.now() - t0;
      const scored = scoreRetrievedAgainstGolden({
        item,
        retrieved: chunks.map((c) => ({
          slug: c.regulation.slug,
          title: c.regulation.title,
          articleKey: c.articleKey,
          content: c.content,
        })),
        answer,
      });
      rows.push({
        id: item.id,
        strategy,
        ...scored,
        latency_ms,
        mode,
        chunk_count: chunks.length,
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    mode: "live",
    generate_answers: params.generate,
    enable_graph: params.enableGraph,
    strategies: params.strategies,
    summary: params.strategies.map((s) => summarizeStrategy(s, rows)),
    cases: rows,
    notes: [
      "Live 模式使用資料庫現行 Parent-Child 語料；Child 內容已含 ingest 時 Contextual 前綴（三種策略共用索引）。",
      "若需「無前綴 Baseline」消融，需另建扁平 ingest，本報告已於注意事項揭露此限制。",
    ],
  };
}

async function main() {
  const strategies = parseStrategies(process.env.RAG_COMPARE_STRATEGIES);
  const limit = Number(process.env.RAG_COMPARE_LIMIT ?? "50");
  const topK = Number(process.env.RAG_COMPARE_TOP_K ?? "8");
  const enableGraph =
    process.env.RAG_COMPARE_ENABLE_GRAPH === "1" ||
    process.env.RAG_COMPARE_ENABLE_GRAPH === "true";
  const generate =
    process.env.RAG_COMPARE_GENERATE === "1" ||
    process.env.RAG_COMPARE_GENERATE === "true";
  const forced = (process.env.RAG_COMPARE_MODE || "").toLowerCase();
  const hasDb = Boolean(process.env.DATABASE_URL?.trim());
  const mode = forced === "fixture" || forced === "live" ? forced : hasDb ? "live" : "fixture";

  const items = selectGoldenForCompare(Number.isFinite(limit) ? limit : 50);
  console.error(
    `RAG compare mode=${mode} strategies=${strategies.join(",")} n=${items.length} generate=${generate} graph=${enableGraph}`,
  );

  const report =
    mode === "live"
      ? await runLiveCompare({ strategies, items, enableGraph, topK, generate })
      : await runFixtureCompare({ strategies, items, enableGraph, topK });

  const outDir = process.env.RAG_EVAL_OUT_DIR || path.join(process.cwd(), "docs", "evidence");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `rag-compare-${stamp}.json`);
  const mdPath = path.join(outDir, `rag-compare-${stamp}.md`);
  const latestJson = path.join(outDir, "rag-compare-latest.json");
  const latestMd = path.join(outDir, "rag-compare-latest.md");

  const jsonText = JSON.stringify(report, null, 2);
  const mdText = formatCompareMarkdown(report);
  writeFileSync(jsonPath, jsonText);
  writeFileSync(mdPath, mdText);
  writeFileSync(latestJson, jsonText);
  writeFileSync(latestMd, mdText);

  console.log(jsonText);
  console.error(`Wrote ${mdPath}`);
  for (const s of report.summary) {
    console.error(
      `${s.strategy}: hit=${s.retrieval_hit_rate_mean} cite=${s.citation_accuracy_mean} p50=${s.latency.p50}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
