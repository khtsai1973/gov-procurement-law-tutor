/**
 * RAG Golden Dataset 載入、驗證與評測轉接。
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import type { RagEvalCase } from "@/lib/rag-eval/types";
import {
  GOLDEN_CATEGORIES,
  type GoldenDatasetFile,
  type GoldenItem,
  type GoldenPhase,
} from "@/lib/rag-eval/golden-types";

const DEFAULT_PATH = path.join(process.cwd(), "data/rag-eval/golden/dataset.json");

export function loadGoldenDataset(filePath?: string): GoldenDatasetFile {
  const p = filePath ?? DEFAULT_PATH;
  const raw = JSON.parse(readFileSync(p, "utf8")) as GoldenDatasetFile;
  validateGoldenDataset(raw);
  return raw;
}

/** All ready items used by automatic golden / FRC evaluation. */
export function listReadyGoldenItems(ds?: GoldenDatasetFile): GoldenItem[] {
  const data = ds ?? loadGoldenDataset();
  return data.items.filter((i) => i.status === "ready");
}

export function listGoldenItemsByPhase(
  phase: GoldenPhase,
  ds?: GoldenDatasetFile,
): GoldenItem[] {
  const data = ds ?? loadGoldenDataset();
  return data.items.filter((i) => i.phase === phase);
}

export function validateGoldenDataset(ds: GoldenDatasetFile): void {
  if (!ds.meta || !Array.isArray(ds.items)) {
    throw new Error("golden dataset: missing meta or items");
  }
  if (ds.meta.target_total !== 200) {
    throw new Error(
      `meta.target_total must be 200, got ${ds.meta.target_total}`,
    );
  }
  if (ds.items.length !== ds.meta.target_total) {
    throw new Error(
      `items.length ${ds.items.length} != meta.target_total ${ds.meta.target_total}`,
    );
  }

  const ids = new Set<string>();
  for (const item of ds.items) {
    if (!/^G\d{3}$/.test(item.id)) {
      throw new Error(`invalid id: ${item.id}`);
    }
    if (ids.has(item.id)) throw new Error(`duplicate id: ${item.id}`);
    ids.add(item.id);
    if (!GOLDEN_CATEGORIES.includes(item.category)) {
      throw new Error(`${item.id}: bad category ${item.category}`);
    }
    if (![1, 2, 3].includes(item.phase)) {
      throw new Error(`${item.id}: invalid phase ${item.phase}`);
    }
    if (item.status === "ready") {
      if (!item.question?.trim()) throw new Error(`${item.id}: empty question`);
      if (!item.gold_answer?.trim()) throw new Error(`${item.id}: empty gold_answer`);
      if (!item.expected_behavior) {
        throw new Error(`${item.id}: missing expected_behavior`);
      }
    }
  }

  const ready = ds.items.filter((i) => i.status === "ready");
  if (ready.length !== ds.meta.ready_count) {
    throw new Error(
      `ready count ${ready.length} != meta.ready_count ${ds.meta.ready_count}`,
    );
  }

  const phase1 = ds.items.filter((i) => i.phase === 1);
  const phase2 = ds.items.filter((i) => i.phase === 2);
  const phase3 = ds.items.filter((i) => i.phase === 3);
  if (phase1.length !== ds.meta.phase1_count) {
    throw new Error(
      `phase1 count ${phase1.length} != meta.phase1_count ${ds.meta.phase1_count}`,
    );
  }
  if (phase2.length !== ds.meta.phase2_count) {
    throw new Error(
      `phase2 count ${phase2.length} != meta.phase2_count ${ds.meta.phase2_count}`,
    );
  }
  if (phase3.length !== ds.meta.phase3_count) {
    throw new Error(
      `phase3 count ${phase3.length} != meta.phase3_count ${ds.meta.phase3_count}`,
    );
  }

  for (const cat of GOLDEN_CATEGORIES) {
    const plan = ds.meta.category_plan[cat];
    if (!plan) throw new Error(`missing category_plan for ${cat}`);
    const inCat = ds.items.filter((i) => i.category === cat);
    if (inCat.length !== plan.total) {
      throw new Error(
        `category ${cat}: items ${inCat.length} != plan.total ${plan.total}`,
      );
    }
    const sum = plan.phase1 + plan.phase2 + plan.phase3;
    if (sum !== plan.total) {
      throw new Error(
        `category ${cat}: phase1+2+3 (${sum}) != total ${plan.total}`,
      );
    }
  }
}

/**
 * 轉成既有 rag-eval cases 格式，便於 Faithfulness／Relevance 離線評分。
 * contexts 以 expected_sources + expected_articles + gold_answer 組合成金標上下文。
 */
export function goldenToRagEvalCase(item: GoldenItem): RagEvalCase {
  const contextParts = [
    item.expected_sources.length
      ? `來源：${item.expected_sources.join("、")}`
      : "",
    item.expected_articles.length
      ? `條號：${item.expected_articles.join("、")}`
      : "",
    item.gold_answer,
  ].filter(Boolean);

  const kind =
    item.expected_behavior === "refuse"
      ? "off_topic"
      : item.expected_behavior === "correct"
        ? "deterministic"
        : "rag_gold";

  const must =
    item.must_include && item.must_include.length > 0
      ? item.must_include
      : deriveMustInclude(item);

  return {
    id: item.id,
    question: item.question,
    contexts: item.expected_behavior === "refuse" ? [] : [contextParts.join("\n")],
    reference_answer: item.gold_answer,
    must_include: must,
    relevance_keywords: relevanceFromItem(item),
    kind,
  };
}

function deriveMustInclude(item: GoldenItem): string[] {
  if (item.expected_behavior === "refuse") {
    return ["非本主題的範圍"];
  }
  const out: string[] = [];
  for (const a of item.expected_articles.slice(0, 2)) {
    const m = a.match(/第\s*\d+\s*條/);
    if (m) out.push(m[0].replace(/\s+/g, " "));
  }
  if (item.category.includes("門檻") || item.category.includes("金額")) {
    for (const t of ["公告金額", "查核金額", "萬"]) {
      if (item.gold_answer.includes(t)) out.push(t);
    }
  }
  return [...new Set(out)].slice(0, 6);
}

function relevanceFromItem(item: GoldenItem): string[] {
  if (item.expected_behavior === "refuse") return [];
  const answer = item.gold_answer;
  const out: string[] = [];

  if (item.must_include?.length) {
    for (const m of item.must_include) {
      if (
        answer.includes(m) ||
        answer.replace(/\s+/g, "").includes(m.replace(/\s+/g, ""))
      ) {
        out.push(m);
      }
    }
  }

  for (const a of item.expected_articles) {
    const m = a.match(/第\s*\d+\s*條/);
    if (m && answer.includes(m[0].replace(/\s+/g, " "))) out.push(m[0]);
    else if (
      m &&
      answer.replace(/\s+/g, "").includes(m[0].replace(/\s+/g, ""))
    ) {
      out.push(m[0]);
    }
  }

  const q = item.question.replace(/\s+/g, "");
  const candidates = [
    "公告金額",
    "查核金額",
    "巨額",
    "小額採購",
    "公開招標",
    "選擇性招標",
    "限制性招標",
    "最低標",
    "最有利標",
    "決標原則",
    "驗收",
    "監辦",
    "資訊服務",
    "專業服務",
    "三家",
    "流標",
    "統包",
    "複數決標",
    "等標期",
    "後續擴充",
    "含稅",
  ];
  for (const c of candidates) {
    if (q.includes(c) && answer.includes(c)) out.push(c);
  }

  return [...new Set(out)].slice(0, 10);
}

export function summarizeGoldenCoverage(ds?: GoldenDatasetFile): {
  ready: number;
  planned: number;
  byCategory: Record<string, { ready: number; planned: number }>;
  byPhase: Record<string, number>;
} {
  const data = ds ?? loadGoldenDataset();
  const byCategory: Record<string, { ready: number; planned: number }> = {};
  for (const c of GOLDEN_CATEGORIES) {
    byCategory[c] = { ready: 0, planned: 0 };
  }
  const byPhase: Record<string, number> = { "1": 0, "2": 0, "3": 0 };
  let ready = 0;
  let planned = 0;
  for (const item of data.items) {
    const bucket = byCategory[item.category] ?? { ready: 0, planned: 0 };
    if (item.status === "ready") {
      ready += 1;
      bucket.ready += 1;
    } else {
      planned += 1;
      bucket.planned += 1;
    }
    byCategory[item.category] = bucket;
    byPhase[String(item.phase)] = (byPhase[String(item.phase)] ?? 0) + 1;
  }
  return { ready, planned, byCategory, byPhase };
}
