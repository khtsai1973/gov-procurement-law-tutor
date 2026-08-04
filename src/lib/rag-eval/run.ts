import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildBelowThresholdSupervisionAnswer,
  isBelowThresholdSupervisionQuery,
} from "@/lib/below-threshold-supervision";
import {
  buildCurrentThresholdFiguresAnswer,
  isCurrentThresholdFiguresQuery,
} from "@/lib/current-threshold-figures";
import {
  buildProcurementAmountDefinitionAnswer,
  isProcurementAmountDefinitionQuery,
} from "@/lib/procurement-amount-definition";
import {
  mean,
  scoreAnswerRelevance,
  scoreContextRecall,
  scoreFaithfulness,
} from "@/lib/rag-eval/metrics";
import type { RagEvalCase, RagEvalCaseScore, RagEvalReport } from "@/lib/rag-eval/types";
import {
  buildSmallPurchaseThresholdAnswer,
  isSmallPurchaseThresholdQuery,
} from "@/lib/small-purchase-threshold";
import { OFF_TOPIC_REPLY, isOnTopicQuestion } from "@/lib/topic-scope";

const DEFAULT_THRESHOLDS = {
  faithfulness: 0.7,
  answer_relevance: 0.7,
  ttfb_p95_ms: 500,
};

export function loadRagEvalCases(filePath?: string): RagEvalCase[] {
  const p = filePath ?? path.join(process.cwd(), "data/rag-eval/cases.json");
  const raw = JSON.parse(readFileSync(p, "utf8")) as RagEvalCase[];
  return raw;
}

/** 離線：以確定性模組或金標 reference 產出答案（不需 DB／OpenAI） */
export function produceOfflineAnswer(c: RagEvalCase): { answer: string; model: string } {
  const q = c.question;
  if (!isOnTopicQuestion(q) || c.kind === "off_topic") {
    return { answer: OFF_TOPIC_REPLY, model: "off-topic" };
  }
  if (isBelowThresholdSupervisionQuery(q)) {
    return { answer: buildBelowThresholdSupervisionAnswer(), model: "below-threshold-supervision-rules" };
  }
  if (isCurrentThresholdFiguresQuery(q)) {
    return { answer: buildCurrentThresholdFiguresAnswer(), model: "current-threshold-figures" };
  }
  if (isSmallPurchaseThresholdQuery(q)) {
    return { answer: buildSmallPurchaseThresholdAnswer(), model: "small-purchase-threshold" };
  }
  if (isProcurementAmountDefinitionQuery(q)) {
    return { answer: buildProcurementAmountDefinitionAnswer(), model: "procurement-amount-definition" };
  }
  if (c.reference_answer) {
    return { answer: c.reference_answer, model: "gold-reference" };
  }
  return { answer: OFF_TOPIC_REPLY, model: "offline-fallback" };
}

export function scoreCase(params: {
  case: RagEvalCase;
  answer: string;
  contexts?: string[];
  latency_ms?: number | null;
  model?: string;
}): RagEvalCaseScore {
  const contexts = params.contexts ?? params.case.contexts;
  const faithfulness = scoreFaithfulness({
    answer: params.answer,
    contexts,
    mustInclude: params.case.must_include,
  });
  const answer_relevance = scoreAnswerRelevance({
    question: params.case.question,
    answer: params.answer,
    relevanceKeywords: params.case.relevance_keywords,
  });
  const context_recall = scoreContextRecall({
    contexts,
    mustInclude: params.case.must_include,
  });

  return {
    id: params.case.id,
    question: params.case.question,
    kind: params.case.kind,
    answer_preview: params.answer.slice(0, 180),
    faithfulness,
    answer_relevance,
    context_recall,
    latency_ms: params.latency_ms ?? null,
    model: params.model,
  };
}

export async function runOfflineRagEval(options?: {
  casesPath?: string;
  faithfulnessThreshold?: number;
  relevanceThreshold?: number;
}): Promise<RagEvalReport> {
  const cases = loadRagEvalCases(options?.casesPath);
  const thresholds = {
    faithfulness: options?.faithfulnessThreshold ?? DEFAULT_THRESHOLDS.faithfulness,
    answer_relevance: options?.relevanceThreshold ?? DEFAULT_THRESHOLDS.answer_relevance,
    ttfb_p95_ms: DEFAULT_THRESHOLDS.ttfb_p95_ms,
  };

  const scored: RagEvalCaseScore[] = [];
  for (const c of cases) {
    const t0 = Date.now();
    const { answer, model } = produceOfflineAnswer(c);
    const latency_ms = Date.now() - t0;
    scored.push(
      scoreCase({
        case: c,
        answer,
        contexts: c.contexts,
        latency_ms,
        model,
      }),
    );
  }

  const fMean = mean(scored.map((s) => s.faithfulness));
  const rMean = mean(scored.map((s) => s.answer_relevance));
  const recallVals = scored
    .map((s) => s.context_recall)
    .filter((n): n is number => n != null);
  const recallMean = recallVals.length ? mean(recallVals) : null;

  const pass =
    fMean >= thresholds.faithfulness && rMean >= thresholds.answer_relevance;

  return {
    generated_at: new Date().toISOString(),
    mode: "offline",
    framework: "ragas-inspired-ts",
    thresholds,
    summary: {
      n: scored.length,
      faithfulness_mean: fMean,
      answer_relevance_mean: rMean,
      context_recall_mean: recallMean,
      pass,
    },
    cases: scored,
    latency: {
      note: "案例 latency_ms 為離線答案產生耗時；頁面 TTFB 請另跑 npm run ttfb:check（目標 p95 < 500ms）。串流互動見 /api/chat SSE。",
    },
  };
}

/** live 模式：實際檢索＋作答（需 DATABASE_URL；可選 OPENAI） */
export async function runLiveRagEval(options?: {
  casesPath?: string;
}): Promise<RagEvalReport> {
  const { retrieveForRag } = await import("@/lib/rag");
  const { generateGroundedAnswer } = await import("@/lib/answer");
  const { ensureKnowledgeBase } = await import("@/lib/bootstrap-knowledge");

  await ensureKnowledgeBase();
  const cases = loadRagEvalCases(options?.casesPath);
  const scored: RagEvalCaseScore[] = [];

  for (const c of cases) {
    const t0 = Date.now();
    let answer: string;
    let model: string;
    let contexts = c.contexts;

    if (c.kind === "off_topic" || !isOnTopicQuestion(c.question)) {
      answer = OFF_TOPIC_REPLY;
      model = "off-topic";
      contexts = [];
    } else {
      const { chunks } = await retrieveForRag(c.question);
      contexts = chunks.map((ch) => ch.content);
      const result = await generateGroundedAnswer(c.question, chunks);
      answer = result.answer;
      model = result.model;
    }

    scored.push(
      scoreCase({
        case: c,
        answer,
        contexts,
        latency_ms: Date.now() - t0,
        model,
      }),
    );
  }

  const fMean = mean(scored.map((s) => s.faithfulness));
  const rMean = mean(scored.map((s) => s.answer_relevance));
  const recallVals = scored
    .map((s) => s.context_recall)
    .filter((n): n is number => n != null);

  return {
    generated_at: new Date().toISOString(),
    mode: "live",
    framework: "ragas-inspired-ts",
    thresholds: DEFAULT_THRESHOLDS,
    summary: {
      n: scored.length,
      faithfulness_mean: fMean,
      answer_relevance_mean: rMean,
      context_recall_mean: recallVals.length ? mean(recallVals) : null,
      pass:
        fMean >= DEFAULT_THRESHOLDS.faithfulness &&
        rMean >= DEFAULT_THRESHOLDS.answer_relevance,
    },
    cases: scored,
  };
}

export function formatRagEvalMarkdown(report: RagEvalReport): string {
  const lines = [
    `# RAG 評測報告（Ragas 風格）`,
    ``,
    `- 產生時間：${report.generated_at}`,
    `- 模式：\`${report.mode}\``,
    `- 框架：${report.framework}`,
    `- 門檻：Faithfulness ≥ ${report.thresholds.faithfulness}；Answer Relevance ≥ ${report.thresholds.answer_relevance}；頁面 TTFB p95 < ${report.thresholds.ttfb_p95_ms} ms`,
    ``,
    `## 摘要`,
    ``,
    `| 指標 | 平均 |`,
    `| --- | ---: |`,
    `| Faithfulness（忠實度） | ${report.summary.faithfulness_mean} |`,
    `| Answer Relevance（相關性） | ${report.summary.answer_relevance_mean} |`,
    `| Context Recall（參考） | ${report.summary.context_recall_mean ?? "—"} |`,
    `| 案例數 | ${report.summary.n} |`,
    `| 判定 | ${report.summary.pass ? "✅ 通過" : "❌ 未通過"} |`,
    ``,
    `## 分案`,
    ``,
    `| ID | Faith. | Relev. | Recall | 模型 |`,
    `| --- | ---: | ---: | ---: | --- |`,
  ];
  for (const c of report.cases) {
    lines.push(
      `| \`${c.id}\` | ${c.faithfulness} | ${c.answer_relevance} | ${c.context_recall ?? "—"} | ${c.model ?? "—"} |`,
    );
  }
  lines.push(``);
  lines.push(`## 指標定義`);
  lines.push(``);
  lines.push(`- **Faithfulness**：回答關鍵事實是否可由檢索／金標上下文支撐（防幻覺）。`);
  lines.push(`- **Answer Relevance**：回答是否對準使用者採購法問題。`);
  lines.push(`- **Latency**：頁面暖機 TTFB p95 < 0.5s（\`npm run ttfb:check\`）；問答採 SSE 串流降低體感等待。`);
  lines.push(``);
  if (report.latency?.note) {
    lines.push(`> ${report.latency.note}`);
    lines.push(``);
  }
  lines.push(`重跑：\`npm run rag:eval\` 或 \`RAG_EVAL_MODE=live npm run rag:eval\``);
  lines.push(``);
  return lines.join("\n");
}
