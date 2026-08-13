/**
 * 階段 2：個人化學習弱點診斷書（Learner Knowledge Tracing）
 * — 結合確定性能力矩陣與錯題概念標籤，產出結構化報告欄位。
 */

import {
  formatCoreStrengths,
  formatKeyWeaknesses,
  type KnowledgeRadarSnapshot,
} from "@/lib/knowledge-radar";
import { resolveAllQuestionTags, resolveKnowledgeTags } from "@/lib/knowledge-tags";
import type { DiagnosticRegulation } from "@/lib/exam-diagnostics-types";

export const PERSONAL_WEAKNESS_REPORT_TITLE = "個人化學習弱點診斷書";

export type PracticeQuestionBrief = {
  key: string;
  category: string;
  question: string;
  tags: string[];
};

export type PersonalWeaknessReport = {
  title: typeof PERSONAL_WEAKNESS_REPORT_TITLE;
  /** 核心強項：正確率 ≥ 85% */
  coreStrengths: string[];
  /** 關鍵弱點：正確率偏低或有錯題之知識軸／概念 */
  keyWeaknesses: string[];
  /** 錯題概念／條次標籤（送入 LLM 知識圖譜分析） */
  wrongConceptTags: string[];
  /** 行動建議：至多 3 條法規連結 */
  regulationLinks: DiagnosticRegulation[];
  /** 行動建議：至多 2 道精準練習題 */
  practiceQuestions: PracticeQuestionBrief[];
};

export function collectWrongConceptTags(
  wrongs: Array<{
    category: string;
    question: string;
    keywords?: string[] | null;
    knowledgeTags?: string[] | null;
    explanation?: string | null;
  }>,
): string[] {
  const out: string[] = [];
  for (const w of wrongs) {
    for (const t of resolveAllQuestionTags(w)) {
      if (!out.includes(t)) out.push(t);
    }
  }
  return out;
}

export function buildPersonalWeaknessReport(params: {
  radar: KnowledgeRadarSnapshot;
  wrongConceptTags: string[];
  regulations: DiagnosticRegulation[];
  practiceQuestions: PracticeQuestionBrief[];
}): PersonalWeaknessReport {
  const coreStrengths = formatCoreStrengths(params.radar);
  const axisWeak = formatKeyWeaknesses(params.radar);
  // 概念標籤補進關鍵弱點（略過已是軸說明的項目）
  const keyWeaknesses = [...axisWeak];
  for (const t of params.wrongConceptTags) {
    if (keyWeaknesses.some((k) => k.startsWith(t) || k.includes(t))) continue;
    // 軸標籤已在 axisWeak 以「標籤（正確率）」呈現
    if (params.radar.axes.some((a) => String(a.tag) === t)) continue;
    keyWeaknesses.push(t);
    if (keyWeaknesses.length >= 10) break;
  }

  return {
    title: PERSONAL_WEAKNESS_REPORT_TITLE,
    coreStrengths,
    keyWeaknesses,
    wrongConceptTags: params.wrongConceptTags,
    regulationLinks: params.regulations.slice(0, 3),
    practiceQuestions: params.practiceQuestions.slice(0, 2),
  };
}

/** 依弱點標籤從題庫挑 2 道未考過的精準練習題 */
export function pickPracticeQuestionsByTags(params: {
  candidates: Array<{
    key: string;
    category: string;
    question: string;
    keywords?: string[] | null;
    relatedSlugs?: string[] | null;
    knowledgeTags?: string[] | null;
  }>;
  weakTags: string[];
  excludeKeys: Set<string>;
  limit?: number;
}): PracticeQuestionBrief[] {
  const limit = params.limit ?? 2;
  const weak = new Set(params.weakTags);
  const scored = params.candidates
    .filter((c) => !params.excludeKeys.has(c.key))
    .map((c) => {
      const tags = resolveAllQuestionTags(c);
      const axes = resolveKnowledgeTags(c);
      const overlap = tags.filter((t) => weak.has(t) || axes.some((a) => weak.has(a))).length;
      return { c, tags, overlap };
    })
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.c.key.localeCompare(b.c.key));

  const out: PracticeQuestionBrief[] = [];
  for (const row of scored) {
    out.push({
      key: row.c.key,
      category: row.c.category,
      question: row.c.question,
      tags: row.tags.slice(0, 8),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export type PersistedDiagnosisBundle = {
  regulations: DiagnosticRegulation[];
  practiceQuestions: PracticeQuestionBrief[];
};

/** 相容舊版：recommendations 可能是純法規陣列，或含練習題的 bundle */
export function parseDiagnosisBundle(raw: string | null | undefined): PersistedDiagnosisBundle {
  const empty: PersistedDiagnosisBundle = { regulations: [], practiceQuestions: [] };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return {
        regulations: parseRegList(parsed),
        practiceQuestions: [],
      };
    }
    if (!parsed || typeof parsed !== "object") return empty;
    const obj = parsed as Record<string, unknown>;
    return {
      regulations: parseRegList(obj.regulations),
      practiceQuestions: parsePracticeList(obj.practiceQuestions),
    };
  } catch {
    return empty;
  }
}

export function stringifyDiagnosisBundle(bundle: PersistedDiagnosisBundle): string {
  return JSON.stringify({
    regulations: bundle.regulations.slice(0, 3),
    practiceQuestions: bundle.practiceQuestions.slice(0, 2),
  });
}

function parseRegList(raw: unknown): DiagnosticRegulation[] {
  if (!Array.isArray(raw)) return [];
  const out: DiagnosticRegulation[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.slug !== "string" || typeof r.title !== "string") continue;
    out.push({
      slug: r.slug,
      title: r.title,
      sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : null,
      reason: typeof r.reason === "string" ? r.reason : null,
    });
  }
  return out;
}

function parsePracticeList(raw: unknown): PracticeQuestionBrief[] {
  if (!Array.isArray(raw)) return [];
  const out: PracticeQuestionBrief[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.key !== "string" || typeof r.question !== "string") continue;
    out.push({
      key: r.key,
      category: typeof r.category === "string" ? r.category : "未分類",
      question: r.question,
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    });
  }
  return out;
}
