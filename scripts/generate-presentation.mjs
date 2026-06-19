import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "docs");
const outFile = path.join(outDir, "政府採購法互動教學平台-專案簡介.pptx");

async function main() {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();

  pptx.author = "Gov Procurement Law Tutor";
  pptx.title = "政府採購法互動教學平台 — 專案簡介";
  pptx.subject = "專案簡介";
  pptx.lang = "zh-TW";
  pptx.layout = "LAYOUT_16x9";

  const colors = {
    accent: "1D4ED8",
    accentLight: "DBEAFE",
    fg: "111827",
    muted: "6B7280",
    green: "10B981",
    white: "FFFFFF",
    bg: "F6F7FB",
  };

  const titleOpts = {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.7,
    fontSize: 28,
    bold: true,
    color: colors.accent,
    fontFace: "Microsoft JhengHei",
  };

  const bodyOpts = {
    x: 0.55,
    y: 1.15,
    w: 9,
    h: 5.5,
    fontSize: 16,
    color: colors.fg,
    fontFace: "Microsoft JhengHei",
    valign: "top",
  };

  function addHeader(slide, text) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.08,
      fill: { color: colors.accent },
      line: { color: colors.accent },
    });
    slide.addText(text, titleOpts);
    slide.addShape(pptx.ShapeType.line, {
      x: 0.5,
      y: 1.05,
      w: 9,
      h: 0,
      line: { color: colors.accentLight, width: 2 },
    });
  }

  // 1 封面
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.bg };
    slide.addShape(pptx.ShapeType.rect, {
      x: 4.2,
      y: 1.2,
      w: 1.6,
      h: 1.6,
      fill: { color: colors.accent },
      rectRadius: 0.2,
    });
    slide.addText("📄✓", {
      x: 4.2,
      y: 1.35,
      w: 1.6,
      h: 1.3,
      fontSize: 36,
      align: "center",
      color: colors.white,
    });
    slide.addText("政府採購法互動教學平台", {
      x: 0.5,
      y: 3.1,
      w: 9,
      h: 0.8,
      fontSize: 34,
      bold: true,
      align: "center",
      color: colors.fg,
      fontFace: "Microsoft JhengHei",
    });
    slide.addText("Gov Procurement Law Tutor", {
      x: 0.5,
      y: 3.85,
      w: 9,
      h: 0.4,
      fontSize: 16,
      align: "center",
      color: colors.muted,
      fontFace: "Arial",
    });
    slide.addText(
      [
        {
          text: "以 Google 帳號登入的交談式教學網站，在已匯入之法規／函釋與題庫知識庫範圍內，",
        },
        { text: "透過 RAG 檢索與 AI 生成，提供有依據的採購法規問答服務。", breakLine: true },
        { text: "專案簡介投影片 · 2026", breakLine: true, options: { fontSize: 12, color: colors.muted } },
      ],
      {
        x: 1.2,
        y: 4.5,
        w: 7.6,
        h: 1.2,
        fontSize: 14,
        align: "center",
        color: colors.muted,
        fontFace: "Microsoft JhengHei",
      },
    );
  }

  // 2 背景
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "專案背景與動機");
    slide.addText(
      [
        { text: "政府採購法及相關子法、行政規則、工程會函釋", options: { bullet: true } },
        { text: "條文繁多、位階複雜", options: { bold: true } },
        { text: "，實務人員與學習者不易快速找到正確依據。", breakLine: true },
        { text: "一般聊天機器人容易", options: { bullet: true, breakLine: true } },
        { text: "幻覺捏造法條", options: { bold: true } },
        { text: "，不適合作為法規諮詢工具。", breakLine: true },
        { text: "需要限定知識庫範圍、可追蹤提問紀錄、區分管理者與一般使用者的教學平台。", options: { bullet: true, breakLine: true } },
        { text: "參考 NotebookLM 文件導向問答思路，聚焦台灣政府採購法規領域。", options: { bullet: true, breakLine: true } },
      ],
      bodyOpts,
    );
  }

  // 3 目標
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "專案目標");
    const cards = [
      ["教學導向", "情境模板與常見問題\n回答附帶參考法規來源"],
      ["知識庫限定", "僅引用已匯入法規全文\n題庫擴展檢索與加權"],
      ["身分與紀錄", "Google OAuth 登入\n區分管理者／一般使用者"],
      ["可部署維運", "Next.js + PostgreSQL\nVercel + Neon 雲端部署"],
    ];
    cards.forEach(([title, body], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.55 + col * 4.7;
      const y = 1.25 + row * 2.55;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: 4.35,
        h: 2.2,
        fill: { color: colors.bg },
        line: { color: "E5E7EB", width: 1 },
        rectRadius: 0.08,
      });
      slide.addText(title, {
        x: x + 0.2,
        y: y + 0.15,
        w: 4,
        h: 0.4,
        fontSize: 15,
        bold: true,
        color: colors.accent,
        fontFace: "Microsoft JhengHei",
      });
      slide.addText(body, {
        x: x + 0.2,
        y: y + 0.6,
        w: 4,
        h: 1.4,
        fontSize: 13,
        color: colors.fg,
        fontFace: "Microsoft JhengHei",
      });
    });
  }

  // 4 功能
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "核心功能一覽");
    const rows = [
      ["互動提問", "情境模板、RAG 檢索 + AI 回答", "登入使用者"],
      ["法規／函釋清單", "依法規位階排序，標示修改日期", "所有人"],
      ["我的提問紀錄", "查閱過往問題與系統回答", "登入使用者"],
      ["知識庫管理", "載入／更新 corpus、embedding", "管理者"],
      ["Google 登入", "NextAuth v5 OAuth", "所有人"],
    ];
    slide.addTable(
      [["功能", "說明", "對象"], ...rows],
      {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 3.2,
        fontSize: 12,
        fontFace: "Microsoft JhengHei",
        border: { type: "solid", color: "E5E7EB", pt: 1 },
        fill: { color: colors.white },
        color: colors.fg,
        colW: [1.5, 5.2, 2.3],
      },
    );
    const stats = [
      ["40+", "法規項目"],
      ["40+", "Corpus 檔"],
      ["2", "題庫來源"],
      ["6", "主要頁面"],
    ];
    stats.forEach(([num, label], i) => {
      const x = 0.55 + i * 2.35;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y: 4.55,
        w: 2.1,
        h: 1.1,
        fill: { color: colors.bg },
        line: { color: "E5E7EB" },
        rectRadius: 0.08,
      });
      slide.addText(num, {
        x,
        y: 4.65,
        w: 2.1,
        h: 0.5,
        fontSize: 22,
        bold: true,
        align: "center",
        color: colors.accent,
        fontFace: "Microsoft JhengHei",
      });
      slide.addText(label, {
        x,
        y: 5.15,
        w: 2.1,
        h: 0.35,
        fontSize: 11,
        align: "center",
        color: colors.muted,
        fontFace: "Microsoft JhengHei",
      });
    });
  }

  // 5 架構
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "系統架構");
    const flows = [
      "使用者瀏覽器  →  Next.js 15  →  NextAuth (Google)",
      "Chat API  →  RAG 檢索引擎  →  PostgreSQL + Prisma",
      "OpenAI Embedding + Chat  →  有依據的回答",
    ];
    flows.forEach((line, i) => {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 1.25 + i * 0.95,
        w: 8.6,
        h: 0.7,
        fill: { color: colors.accentLight },
        line: { color: colors.accent, width: 1 },
        rectRadius: 0.06,
      });
      slide.addText(line, {
        x: 0.9,
        y: 1.38 + i * 0.95,
        w: 8.2,
        h: 0.45,
        fontSize: 14,
        bold: true,
        color: colors.accent,
        fontFace: "Microsoft JhengHei",
        align: "center",
      });
    });
    slide.addText("前端：React 19、Tailwind CSS、Noto Sans TC", {
      x: 0.55,
      y: 4.2,
      w: 4.3,
      h: 0.9,
      fontSize: 13,
      fontFace: "Microsoft JhengHei",
      fill: { color: colors.bg },
    });
    slide.addText("資料：User、Regulation、DocChunk、UserQuestion、QuestionBankItem", {
      x: 5.1,
      y: 4.2,
      w: 4.35,
      h: 0.9,
      fontSize: 13,
      fontFace: "Microsoft JhengHei",
      fill: { color: colors.bg },
    });
  }

  // 6 RAG
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "知識庫與 RAG 回答流程");
    const steps = [
      "語料匯入：data/corpus/ Markdown 或全國法規資料庫 API",
      "分塊與向量化：條文切分 DocChunk，OpenAI embedding",
      "題庫輔助：關鍵詞擴展與相關法規 slug 加權",
      "混合檢索：語意相似度 + 關鍵字；無匹配不回傳無關片段",
      "生成回答：僅依檢索片段作答並標註來源",
      "降級機制：OpenAI 不可用時以關鍵字摘錄 fallback",
    ];
    slide.addText(
      steps.map((s, i) => ({ text: s, options: { bullet: true, breakLine: i < steps.length - 1 } })),
      bodyOpts,
    );
  }

  // 7 法規
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "法規涵蓋範圍（節錄）");
    slide.addText(
      [
        { text: "政府採購法、施行細則", options: { bullet: true, breakLine: true } },
        { text: "未達公告金額採購招標／監辦辦法", options: { bullet: true, breakLine: true } },
        { text: "最有利標評選辦法、採購評選委員會組織準則", options: { bullet: true, breakLine: true } },
        { text: "投標廠商資格與特殊或巨額採購認定標準", options: { bullet: true, breakLine: true } },
        { text: "採購契約要項、採購申訴審議規則", options: { bullet: true, breakLine: true } },
        { text: "各類型採購錯誤行為態樣", options: { bullet: true, breakLine: true } },
      ],
      { ...bodyOpts, x: 0.55, w: 4.3 },
    );
    slide.addText(
      [
        { text: "公共工程招標文件公開閱覽制度實施要點", options: { bullet: true, breakLine: true } },
        { text: "統包作業須知、國際競圖注意事項", options: { bullet: true, breakLine: true } },
        { text: "專業／技術／資訊服務評選及計費辦法", options: { bullet: true, breakLine: true } },
        { text: "工程會採購金額門檻、保證金作業規定", options: { bullet: true, breakLine: true } },
        { text: "資源回收再利用法（相關採購）", options: { bullet: true, breakLine: true } },
        { text: "評選委員會專家學者名單資料庫相關要點", options: { bullet: true, breakLine: true } },
      ],
      { ...bodyOpts, x: 5.1, w: 4.3 },
    );
    slide.addText("完整清單見網站「法規／函釋清單」頁面，依法規位階排序。", {
      x: 0.55,
      y: 5.8,
      w: 9,
      h: 0.4,
      fontSize: 11,
      color: colors.muted,
      fontFace: "Microsoft JhengHei",
    });
  }

  // 8 角色
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "使用者角色與權限");
    slide.addTable(
      [
        ["角色", "權限", "判定方式"],
        ["訪客", "瀏覽法規清單", "未登入"],
        ["一般使用者", "提問、個人提問紀錄", "Google 登入"],
        ["管理者", "知識庫載入／更新", "ADMIN_EMAILS 環境變數"],
      ],
      {
        x: 0.5,
        y: 1.3,
        w: 9,
        fontSize: 14,
        fontFace: "Microsoft JhengHei",
        border: { type: "solid", color: "E5E7EB", pt: 1 },
        colW: [2, 4.5, 2.5],
      },
    );
  }

  // 9 頁面
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "主要頁面導覽");
    const pages = [
      ["/ 首頁", "互動提問：情境模板、等待動畫、回答與來源"],
      ["/regulations", "法規／函釋清單，位階排序"],
      ["/my-questions", "登入使用者的歷史提問紀錄"],
      ["/admin", "管理者知識庫 ingest／embedding"],
      ["/auth/setup", "Google OAuth 設定引導"],
      ["文件", "README、DEPLOY.md、GOOGLE-OAUTH.md"],
    ];
    pages.forEach(([name, desc], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.55 + col * 4.7;
      const y = 1.2 + row * 1.45;
      slide.addText(name, {
        x: x + 0.15,
        y,
        w: 4.2,
        h: 0.35,
        fontSize: 13,
        bold: true,
        color: colors.accent,
        fontFace: "Microsoft JhengHei",
      });
      slide.addText(desc, {
        x: x + 0.15,
        y: y + 0.38,
        w: 4.2,
        h: 0.7,
        fontSize: 12,
        color: colors.fg,
        fontFace: "Microsoft JhengHei",
      });
    });
  }

  // 10 歷史沿革
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "歷史沿革");
    const phases = [
      ["第一階段｜專案啟動", "Next.js + Prisma + PostgreSQL 基礎架構"],
      ["第二階段｜身分與權限", "Google OAuth、ADMIN／USER 角色、提問紀錄"],
      ["第三階段｜知識庫建置", "法規清單、corpus 文本、位階排序頁面"],
      ["第四階段｜RAG 問答", "分塊、embedding、OpenAI 生成與來源引用"],
      ["第五階段｜語料擴充", "法規 API、工程會要點、PDF 題庫匯入"],
      ["第六階段｜品質與體驗", "檢索優化、OAuth 修正、UI、LOGO、部署"],
    ];
    phases.forEach(([phase, desc], i) => {
      const y = 1.15 + i * 0.85;
      slide.addShape(pptx.ShapeType.ellipse, {
        x: 0.55,
        y: y + 0.08,
        w: 0.18,
        h: 0.18,
        fill: { color: colors.accent },
      });
      slide.addText(phase, {
        x: 0.85,
        y,
        w: 8.5,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: colors.accent,
        fontFace: "Microsoft JhengHei",
      });
      slide.addText(desc, {
        x: 0.85,
        y: y + 0.32,
        w: 8.5,
        h: 0.4,
        fontSize: 11,
        color: colors.fg,
        fontFace: "Microsoft JhengHei",
      });
    });
  }

  // 11 修改歷程
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "重要修改歷程");
    slide.addTable(
      [
        ["項目", "修改內容"],
        ["認證系統", "NextAuth v5 + Prisma Adapter；JWT session"],
        ["提問 API", "trim 驗證、明確錯誤訊息、email 補查 userId"],
        ["檢索引擎", "中文 n-gram、無匹配不回傳無關片段"],
        ["語意檢索", "OpenAI embedding + cosine 相似度"],
        ["語料管道", "fetch-moj、build-core-laws、rag-init"],
        ["題庫", "starter.json + PDF 全題庫匯入"],
        ["UI/UX", "區塊配色、等待動畫、自動捲動、LOGO"],
        ["部署", "Vercel + Neon + Google OAuth 正式版說明"],
      ],
      {
        x: 0.5,
        y: 1.15,
        w: 9,
        h: 4.8,
        fontSize: 11,
        fontFace: "Microsoft JhengHei",
        border: { type: "solid", color: "E5E7EB", pt: 1 },
        colW: [1.8, 7.2],
      },
    );
  }

  // 12 技術棧
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "技術棧與工具鏈");
    const blocks = [
      ["應用層", "Next.js 15、React 19、TypeScript\nTailwind CSS、Zod"],
      ["資料與 AI", "Prisma 6 + PostgreSQL\nOpenAI API、pdf-parse"],
      ["常用指令", "npm run dev / db:init\ncorpus:rag-init"],
      ["部署目標", "Vercel、Neon Postgres\nGoogle Cloud OAuth"],
    ];
    blocks.forEach(([title, body], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.55 + col * 4.7;
      const y = 1.25 + row * 2.55;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: 4.35,
        h: 2.2,
        fill: { color: colors.bg },
        line: { color: "E5E7EB" },
        rectRadius: 0.08,
      });
      slide.addText(title, {
        x: x + 0.2,
        y: y + 0.15,
        w: 4,
        h: 0.35,
        fontSize: 14,
        bold: true,
        color: colors.accent,
        fontFace: "Microsoft JhengHei",
      });
      slide.addText(body, {
        x: x + 0.2,
        y: y + 0.55,
        w: 4,
        h: 1.5,
        fontSize: 12,
        fontFace: "Microsoft JhengHei",
      });
    });
  }

  // 13 UI
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "近期 UI／UX 優化");
    slide.addText(
      [
        { text: "區塊色彩底圖：標題、情境、提問、範例、等待、回答各區分色", options: { bullet: true, breakLine: true } },
        { text: "等待動畫：三點跳動 +「正在檢索法規並產生回答」", options: { bullet: true, breakLine: true } },
        { text: "自動捲動：答案產生後平滑捲至回答區塊", options: { bullet: true, breakLine: true } },
        { text: "品牌 LOGO：法規文件 + 綠色勾選，套用導覽列與 favicon", options: { bullet: true, breakLine: true } },
        { text: "科技感背景：首頁提問面板網格光暈底圖", options: { bullet: true, breakLine: true } },
      ],
      bodyOpts,
    );
  }

  // 14 展望
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.white };
    addHeader(slide, "未來展望");
    slide.addText(
      [
        { text: "持續補齊工程會最新函釋與要點全文", options: { bullet: true, breakLine: true } },
        { text: "強化檢索評測（Recall / 正確引用率）", options: { bullet: true, breakLine: true } },
        { text: "支援更多題庫來源與自動更新排程", options: { bullet: true, breakLine: true } },
        { text: "多輪對話與追問脈絡擴展", options: { bullet: true, breakLine: true } },
        { text: "正式環境 OAuth 發布與機關內部試用推廣", options: { bullet: true, breakLine: true } },
      ],
      bodyOpts,
    );
  }

  // 15 結尾
  {
    const slide = pptx.addSlide();
    slide.background = { color: colors.bg };
    slide.addText("謝謝聆聽", {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 0.9,
      fontSize: 36,
      bold: true,
      align: "center",
      color: colors.fg,
      fontFace: "Microsoft JhengHei",
    });
    slide.addText("政府採購法互動教學平台", {
      x: 0.5,
      y: 3.4,
      w: 9,
      h: 0.5,
      fontSize: 18,
      align: "center",
      color: colors.muted,
      fontFace: "Microsoft JhengHei",
    });
    slide.addText("本機：http://localhost:3000\n專案：gov-procurement-law-tutor\n詳見 README.md、DEPLOY.md", {
      x: 2,
      y: 4.2,
      w: 6,
      h: 1.2,
      fontSize: 13,
      align: "center",
      color: colors.muted,
      fontFace: "Microsoft JhengHei",
    });
  }

  fs.mkdirSync(outDir, { recursive: true });
  await pptx.writeFile({ fileName: outFile });
  console.log("Wrote:", outFile);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
