import type { NextConfig } from "next";

import { buildContentSecurityPolicy } from "./src/lib/csp";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy({
      isDev: process.env.NODE_ENV !== "production",
    }),
  },
];

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
    // 儀表板／模擬考圖表才用到 recharts，避免整包打進無關頁
    optimizePackageImports: ["recharts"],
    // 依實際 CSS 依賴切塊，減少各頁下載未使用樣式
    cssChunking: "strict",
  },
  // 目標瀏覽器已支援 ES modules；略過 Next 內建 nomodule polyfill（Lighthouse ~11–13KB）
  webpack: (config) => {
    config.plugins = config.plugins?.filter((plugin) => {
      if (plugin?.constructor?.name !== "CopyFilePlugin") return true;
      const filePath = (plugin as { filePath?: string }).filePath;
      return !filePath?.includes("polyfill-nomodule");
    });
    return config;
  },
  // 僅管理／匯入相關路由需要題庫與語料檔，避免所有 serverless 函式打包過大拖慢冷啟動
  outputFileTracingIncludes: {
    "/admin": ["./data/question-bank/**/*", "./data/corpus/**/*"],
    "/admin/:path*": ["./data/question-bank/**/*", "./data/corpus/**/*"],
    "/api/admin/:path*": ["./data/question-bank/**/*", "./data/corpus/**/*"],
    "/teacher/:path*": ["./data/question-bank/**/*"],
    "/question-bank": ["./data/question-bank/high-priority-explanations.json"],
    "/api/mock-exam/:path*": ["./data/question-bank/high-priority-explanations.json"],
    // PDF 匯出需內嵌繁中字型（@fontsource/noto-sans-tc）
    "/api/materials/[id]/document": [
      "./node_modules/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-400-normal.woff",
      "./node_modules/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-700-normal.woff",
    ],
    "/api/teacher/materials/[id]/document": [
      "./node_modules/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-400-normal.woff",
      "./node_modules/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-700-normal.woff",
    ],
  },
  serverExternalPackages: ["pdfkit", "fontkit"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
