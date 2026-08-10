/**
 * 選出各正式分類約 10 題高頻題，產生七段式完整教學解析覆寫 JSON。
 *
 * 用法：npx tsx scripts/build-high-priority-teaching-explanations.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { OFFICIAL_QUESTION_BANK_CATEGORIES } from "../src/lib/question-bank-categories";
import { teachingExplanationToHintAnswer } from "../src/lib/teaching-explanation";
import { parseReferenceAnswer } from "../src/lib/mock-exam";

type BankItem = {
  key: string;
  question: string;
  keywords: string[];
  relatedSlugs: string[];
  category: string;
  hintAnswer?: string;
};

const ROOT = process.cwd();
const BANK_PATH = path.join(ROOT, "data/question-bank/gpa-full-question-bank.json");
const STARTER_PATH = path.join(ROOT, "data/question-bank/starter.json");
const OUT_PATH = path.join(ROOT, "data/question-bank/high-priority-explanations.json");
const PER_CATEGORY = 10;

const HIGH_FREQ_TERMS = [
  "公告金額",
  "查核金額",
  "巨額",
  "公開招標",
  "限制性招標",
  "選擇性招標",
  "最有利標",
  "底價",
  "押標金",
  "保證金",
  "異議",
  "申訴",
  "停權",
  "轉包",
  "分包",
  "驗收",
  "決標",
  "開標",
  "等標期",
  "未達公告金額",
  "利益衝突",
  "評選",
  "共同供應契約",
  "電子採購",
  "履約",
  "違約",
  "第22條",
  "第50條",
  "第101條",
];

function loadItems(file: string): BankItem[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as { items: BankItem[] };
  return raw.items ?? [];
}

function scoreItem(item: BankItem): number {
  let score = 0;
  const blob = `${item.question}\n${(item.keywords ?? []).join("\n")}`;
  for (const term of HIGH_FREQ_TERMS) {
    if (blob.includes(term)) score += 3;
  }
  if (/第\s*\d{1,3}\s*條/.test(item.question)) score += 4;
  if (/\(\s*1\s*\).*\(\s*4\s*\)/s.test(item.question)) score += 1;
  // 較短清楚題幹略加分
  if (item.question.length < 180) score += 2;
  else if (item.question.length < 260) score += 1;
  // 有參考答案
  if (parseReferenceAnswer(item.hintAnswer, "MULTIPLE_CHOICE")) score += 2;
  return score;
}

function pickTopPerCategory(items: BankItem[], n: number): BankItem[] {
  const byCat = new Map<string, BankItem[]>();
  for (const item of items) {
    const list = byCat.get(item.category) ?? [];
    list.push(item);
    byCat.set(item.category, list);
  }

  const picked: BankItem[] = [];
  for (const cat of OFFICIAL_QUESTION_BANK_CATEGORIES) {
    const list = [...(byCat.get(cat) ?? [])];
    list.sort((a, b) => {
      const ds = scoreItem(b) - scoreItem(a);
      if (ds !== 0) return ds;
      return a.key.localeCompare(b.key);
    });
    picked.push(...list.slice(0, n));
  }
  return picked;
}

function buildOverlayItem(
  item: BankItem,
  similarPool: BankItem[],
): { key: string; importance: "high"; hintAnswer: string } | null {
  const correct = parseReferenceAnswer(item.hintAnswer, "MULTIPLE_CHOICE");
  if (!correct) return null;

  const similar = similarPool
    .filter((x) => x.key !== item.key && x.category === item.category)
    .slice(0, 3)
    .map((x) => ({ key: x.key, question: x.question }));

  const hintAnswer = teachingExplanationToHintAnswer({
    question: item.question,
    category: item.category,
    keywords: item.keywords,
    relatedSlugs: item.relatedSlugs,
    correctOption: correct,
    similarQuestions: similar,
  });

  return { key: item.key, importance: "high", hintAnswer };
}

function main() {
  const bank = loadItems(BANK_PATH);
  const starter = loadItems(STARTER_PATH);
  const picked = pickTopPerCategory(bank, PER_CATEGORY);

  const byCatCount = new Map<string, number>();
  for (const item of picked) {
    byCatCount.set(item.category, (byCatCount.get(item.category) ?? 0) + 1);
  }

  const overlayItems: { key: string; importance: "high"; hintAnswer: string }[] = [];
  const seen = new Set<string>();

  for (const item of picked) {
    const row = buildOverlayItem(item, picked);
    if (!row || seen.has(row.key)) continue;
    overlayItems.push(row);
    seen.add(row.key);
  }

  // 保留 starter 高頻題（門檻等），亦改為七段式
  for (const item of starter) {
    if (seen.has(item.key)) continue;
    const correct = parseReferenceAnswer(item.hintAnswer, "MULTIPLE_CHOICE");
    // starter 多為問答型，若無可解析選項則跳過結構化 MC 產生
    if (!correct) {
      // 仍標記 high：用既有 hint 包成七段（簡化）
      if (!item.hintAnswer?.trim()) continue;
      const hintAnswer = teachingExplanationToHintAnswer({
        question: `${item.question} (1)是。 (2)否。 (3)視個案。 (4)以上皆非。`,
        category: item.category,
        keywords: item.keywords,
        relatedSlugs: item.relatedSlugs,
        correctOption: "1",
        similarQuestions: [],
      }).replace(
        /【正確答案】\n[\s\S]*?(?=\n【)/,
        `【正確答案】\n（概念題）請依學習導引作答；原參考導引：${item.hintAnswer.trim().slice(0, 120)}\n\n`,
      );
      // Better: manually format for starter concept questions
      continue;
    }
    const row = buildOverlayItem(item, starter);
    if (!row) continue;
    overlayItems.push(row);
    seen.add(row.key);
  }

  // 為 starter 概念題（無 (1)(2)(3)(4)）另外組七段
  for (const item of starter) {
    if (seen.has(item.key)) continue;
    const articles = (item.question.match(/第\s*\d{1,3}\s*條/g) ?? []).slice(0, 3);
    const titles = (item.relatedSlugs ?? [])
      .map((s) => s)
      .join("、");
    const hintAnswer = [
      item.hintAnswer?.includes("參考答案")
        ? item.hintAnswer.split("\n")[0]
        : "【題庫】本題參考答案為 請依法規全文判斷。",
      "【完整解析】",
      "【正確答案】",
      (item.hintAnswer ?? "請依知識庫法規全文作答").trim(),
      "",
      "【法規名稱與條號】",
      `請查閱：${titles || "government-procurement-act"}。${articles.length ? `條號提示：${articles.join("、")}` : ""}`,
      "",
      "【正確理由】",
      `本題屬「${item.category}」高頻概念。先確認事實與金額／程序級距，再對照知識庫法規／函釋全文；數字門檻以工程會最新公告為準。`,
      "",
      "【錯誤選項分析】",
      "常見錯誤是套錯招標方式、金額門檻或權責層級。作答時逐項核對題幹條件與法條要件是否相符。",
      "",
      "【常見陷阱】",
      "易混淆公開招標「三家」與第22條特殊情形、以及公告／查核／巨額門檻；勿僅背題庫短句。",
      "",
      "【官方來源】",
      `本站法規／函釋清單：${(item.relatedSlugs ?? []).join("、") || "government-procurement-act"}`,
      "公共工程委員會（工程會）公告／函釋",
      "",
      "【相似題目】",
      "請於題庫篩選「重要／高頻」練習同分類題目。",
      "",
      "正式作答須以檢索到的法規／函釋全文為準，勿僅依題庫背誦。",
    ].join("\n");
    overlayItems.push({ key: item.key, importance: "high", hintAnswer });
    seen.add(item.key);
  }

  const payload = {
    version: 2,
    kind: "explanations-overlay" as const,
    note: "各正式分類約10題高頻題之七段式完整教學解析覆寫（正確答案／法規條號／正確理由／錯誤選項分析／常見陷阱／官方來源／相似題目）。解析為學習導引，非法條原文。",
    itemCount: overlayItems.length,
    perCategory: Object.fromEntries(
      OFFICIAL_QUESTION_BANK_CATEGORIES.map((c) => [c, byCatCount.get(c) ?? 0]),
    ),
    items: overlayItems,
  };

  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${overlayItems.length} overlays → ${path.relative(ROOT, OUT_PATH)}`,
  );
  for (const [c, n] of Object.entries(payload.perCategory)) {
    console.log(`  ${n}\t${c}`);
  }
}

main();
