import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL?.trim()) {
  console.warn(
    "[build] DATABASE_URL 未設定，使用占位字串僅供 prisma generate（正式環境仍須在 Vercel 設定 Neon 連線字串）",
  );
  process.env.DATABASE_URL =
    "postgresql://build:build@127.0.0.1:5432/build?schema=public&sslmode=require";
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
