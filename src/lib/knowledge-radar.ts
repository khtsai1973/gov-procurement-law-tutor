/**
 * 確定性診斷引擎：依錯題知識標籤計算雷達圖數值（Rule-based）。
 */

import {
  KNOWLEDGE_TAG_AXES,
  resolveKnowledgeTags,
  type KnowledgeTag,
  type TagSourceItem,
} from "@/lib/knowledge-tags";

export type RadarAxisStat = {
  tag: KnowledgeTag | string;
  correct: number;
  wrong: number;
  total: number;
  /** 0–100；無評分題時為 null */
  pct: number | null;
};

export type KnowledgeRadarSnapshot = {
  engine: "rule-v1";
  /** 本場有出現的知識軸統計（含正確率）＝能力矩陣 */
  axes: RadarAxisStat[];
  /** 弱點標籤（正確率低或錯題多），供 LLM 生成建議 */
  weakTags: string[];
  /** 強項標籤（正確率 ≥ 85%） */
  strongTags: string[];
};

export type TaggedAnswerRow = {
  isCorrect: boolean | null;
  revealed: boolean;
  tags: string[];
};

/** 關鍵弱點：正確率低於此值（或有錯題） */
export const WEAK_PCT_THRESHOLD = 60;
/** 核心強項：正確率需 ≥ 此值（對齊學習弱點診斷書） */
export const STRONG_PCT_THRESHOLD = 85;

export type CapabilityMatrixLabel = {
  tag: string;
  pct: number;
  role: "strength" | "weakness" | "neutral";
};

/** 由雷達產出能力矩陣標籤（強項／弱點／中性） */
export function buildCapabilityMatrix(radar: KnowledgeRadarSnapshot): CapabilityMatrixLabel[] {
  return radar.axes
    .filter((a) => a.pct != null)
    .map((a) => {
      const pct = a.pct!;
      let role: CapabilityMatrixLabel["role"] = "neutral";
      if (pct >= STRONG_PCT_THRESHOLD) role = "strength";
      else if (pct < WEAK_PCT_THRESHOLD || a.wrong > 0) role = "weakness";
      return { tag: String(a.tag), pct, role };
    });
}

/** 核心強項文案（正確率 > 85% 門檻以 ≥85 實作） */
export function formatCoreStrengths(radar: KnowledgeRadarSnapshot): string[] {
  return radar.axes
    .filter((a) => a.pct != null && a.pct >= STRONG_PCT_THRESHOLD && a.total >= 1)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    .map((a) => `${a.tag}（正確率 ${a.pct}%）`);
}

/** 關鍵弱點文案 */
export function formatKeyWeaknesses(radar: KnowledgeRadarSnapshot): string[] {
  return radar.axes
    .filter(
      (a) =>
        a.pct != null && (a.pct < WEAK_PCT_THRESHOLD || (a.wrong > 0 && a.pct < STRONG_PCT_THRESHOLD)),
    )
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0) || b.wrong - a.wrong)
    .map((a) => `${a.tag}（正確率 ${a.pct}%）`);
}

/**
 * 由已標籤的作答列計算雷達軸。
 * 僅統計 revealed 且可評分（isCorrect !== null）的題。
 */
export function computeKnowledgeRadar(rows: TaggedAnswerRow[]): KnowledgeRadarSnapshot {
  const map = new Map<string, { correct: number; wrong: number; total: number }>();

  for (const row of rows) {
    if (!row.revealed || row.isCorrect === null) continue;
    const tags = row.tags.length > 0 ? row.tags : ["招標程序"];
    for (const tag of tags) {
      const cell = map.get(tag) ?? { correct: 0, wrong: 0, total: 0 };
      cell.total += 1;
      if (row.isCorrect) cell.correct += 1;
      else cell.wrong += 1;
      map.set(tag, cell);
    }
  }

  // 固定軸順序；本場未出現的軸不進雷達（避免全 0 誤導）
  const axes: RadarAxisStat[] = [];
  for (const tag of KNOWLEDGE_TAG_AXES) {
    const cell = map.get(tag);
    if (!cell || cell.total === 0) continue;
    axes.push({
      tag,
      correct: cell.correct,
      wrong: cell.wrong,
      total: cell.total,
      pct: Math.round((cell.correct / cell.total) * 100),
    });
  }
  // 若有非標準標籤（理論上不會）
  for (const [tag, cell] of map) {
    if (axes.some((a) => a.tag === tag)) continue;
    axes.push({
      tag,
      correct: cell.correct,
      wrong: cell.wrong,
      total: cell.total,
      pct: Math.round((cell.correct / cell.total) * 100),
    });
  }

  const weakTags = axes
    .filter((a) => a.pct != null && (a.pct < WEAK_PCT_THRESHOLD || a.wrong > 0))
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0) || b.wrong - a.wrong)
    .map((a) => String(a.tag));

  const strongTags = axes
    .filter((a) => a.pct != null && a.pct >= STRONG_PCT_THRESHOLD && a.total >= 1)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    .map((a) => String(a.tag));

  return { engine: "rule-v1", axes, weakTags, strongTags };
}

/** 便利：題庫列＋作答 → 雷達 */
export function computeKnowledgeRadarFromItems(
  answers: Array<{
    isCorrect: boolean | null;
    revealed: boolean;
    item: TagSourceItem;
  }>,
): KnowledgeRadarSnapshot {
  return computeKnowledgeRadar(
    answers.map((a) => ({
      isCorrect: a.isCorrect,
      revealed: a.revealed,
      tags: resolveKnowledgeTags(a.item),
    })),
  );
}

export function formatRadarForPrompt(radar: KnowledgeRadarSnapshot): string {
  if (radar.axes.length === 0) {
    return "（本場尚無足以計算雷達圖的已評分題）";
  }
  const lines = radar.axes.map(
    (a) =>
      `- ${a.tag}：正確率 ${a.pct ?? "—"}%（對 ${a.correct}／錯 ${a.wrong}／計 ${a.total}）`,
  );
  lines.push(`關鍵弱點（正確率 < ${WEAK_PCT_THRESHOLD}% 或有錯題）：${radar.weakTags.join("、") || "無"}`);
  lines.push(
    `核心強項（正確率 ≥ ${STRONG_PCT_THRESHOLD}%）：${radar.strongTags.join("、") || "無"}`,
  );
  return lines.join("\n");
}
