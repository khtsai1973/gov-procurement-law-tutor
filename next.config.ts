import type { NextConfig } from "next";

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
  },
  // 確保 Vercel serverless 可讀取題庫／語料檔以便管理者重匯與自動遷移
  outputFileTracingIncludes: {
    "/*": ["./data/question-bank/**/*", "./data/corpus/**/*"],
  },
};

export default nextConfig;
