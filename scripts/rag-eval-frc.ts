#!/usr/bin/env node
/**
 * Faithfulness + Relevance + Citation Accuracy（FRC）專項評測
 *
 * 預設：Golden Phase1，以 gold_answer 離線自洽評分（驗證標註與指標）。
 *
 *   npm run rag:eval:frc
 *   RAG_FRC_LIMIT=20 npm run rag:eval:frc
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { formatFrcMarkdownTable, scoreFRC } from "../src/lib/rag-eval/frc";
import {
  goldenToRagEvalCase,
  listReadyGoldenItems,
  loadGoldenDataset,
  summarizeGoldenCoverage,
} from "../src/lib/rag-eval/golden";
import { mean } from "../src/lib/rag-eval/metrics";

async function main() {
  const ds = loadGoldenDataset();
  const limit = Number(process.env.RAG_FRC_LIMIT ?? "0");
  let items = listReadyGoldenItems(ds);
  if (Number.isFinite(limit) && limit > 0) items = items.slice(0, limit);

  const cov = summarizeGoldenCoverage(ds);
  console.error(`FRC eval n=${items.length} ready=${cov.ready}`);

  const rows = items.map((item) => {
    const c = goldenToRagEvalCase(item);
    const frc = scoreFRC({
      question: item.question,
      answer: item.gold_answer,
      contexts: c.contexts,
      mustInclude: c.must_include,
      relevanceKeywords: c.relevance_keywords,
      expectedArticles: item.expected_articles,
      expectedSources: item.expected_sources,
      behavior: item.expected_behavior,
      // 金標正文未必含 [片段N]；以條號／來源為主，關閉強制 marker
      expectFragmentMarkers: false,
    });
    return {
      id: item.id,
      category: item.category,
      behavior: item.expected_behavior,
      ...frc,
    };
  });

  const answerRows = rows.filter((r) => r.behavior !== "refuse");
  const fMean = mean(rows.map((r) => r.faithfulness));
  const rMean = mean(rows.map((r) => r.relevance));
  const cVals = answerRows
    .map((r) => r.citation_accuracy)
    .filter((n): n is number => n != null);
  const cMean = cVals.length ? mean(cVals) : null;
  const frcMean = mean(rows.map((r) => r.frc_mean));

  const thresholds = {
    faithfulness: Number(process.env.FRC_FAITHFULNESS_MIN ?? "0.7"),
    relevance: Number(process.env.FRC_RELEVANCE_MIN ?? "0.7"),
    citation: Number(process.env.FRC_CITATION_MIN ?? "0.65"),
  };
  const pass =
    fMean >= thresholds.faithfulness &&
    rMean >= thresholds.relevance &&
    (cMean == null || cMean >= thresholds.citation);

  const report = {
    generated_at: new Date().toISOString(),
    framework: "frc-ts",
    mode: "golden-offline",
    n: rows.length,
    thresholds,
    summary: {
      faithfulness_mean: fMean,
      relevance_mean: rMean,
      citation_accuracy_mean: cMean,
      frc_mean: frcMean,
      pass,
    },
    by_category: Object.fromEntries(
      [...new Set(rows.map((r) => r.category))].map((cat) => {
        const subset = rows.filter((r) => r.category === cat);
        const cites = subset
          .map((r) => r.citation_accuracy)
          .filter((n): n is number => n != null);
        return [
          cat,
          {
            n: subset.length,
            faithfulness_mean: mean(subset.map((r) => r.faithfulness)),
            relevance_mean: mean(subset.map((r) => r.relevance)),
            citation_accuracy_mean: cites.length ? mean(cites) : null,
            frc_mean: mean(subset.map((r) => r.frc_mean)),
          },
        ];
      }),
    ),
    cases: rows,
  };

  const md = [
    "# Faithfulness + Relevance + Citation Accuracy（FRC）",
    "",
    `- 產生時間：${report.generated_at}`,
    `- 模式：\`${report.mode}\`（Golden Phase1 gold_answer 自洽）`,
    `- 題數：${report.n}`,
    "",
    "## 總覽",
    "",
    `| 指標 | 均值 | 門檻 |`,
    `|------|------|------|`,
    `| Faithfulness | ${fMean} | ≥ ${thresholds.faithfulness} |`,
    `| Relevance | ${rMean} | ≥ ${thresholds.relevance} |`,
    `| Citation Accuracy | ${cMean ?? "—"} | ≥ ${thresholds.citation} |`,
    `| **FRC mean** | **${frcMean}** | — |`,
    `| pass | ${pass} | |`,
    "",
    "## 指標定義",
    "",
    "- **Faithfulness**：答案關鍵事實可由 contexts／must_include 支撐（防幻覺）。",
    "- **Relevance**：答案對準問題關鍵詞／主題。",
    "- **Citation Accuracy**：預期條號與來源是否出現在答案（綜合 article_hit／source_hit；生成管線可再開 fragment marker）。",
    "",
    "## 各題",
    "",
    formatFrcMarkdownTable(rows),
    "",
  ].join("\n");

  const outDir = process.env.RAG_EVAL_OUT_DIR || path.join(process.cwd(), "docs", "evidence");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `rag-frc-${stamp}.json`);
  const mdPath = path.join(outDir, `rag-frc-${stamp}.md`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(mdPath, md);
  writeFileSync(path.join(outDir, "rag-frc-latest.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(outDir, "rag-frc-latest.md"), md);

  console.log(JSON.stringify(report.summary, null, 2));
  console.error(`Wrote ${mdPath}`);
  console.error(
    `F=${fMean} R=${rMean} C=${cMean} FRC=${frcMean} pass=${pass}`,
  );
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
