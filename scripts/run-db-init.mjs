/**
 * 初始化 PostgreSQL + Prisma（避開 PowerShell 將 Prisma stderr 當成錯誤）
 * 用法：node scripts/run-db-init.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);

loadDotenv({ path: path.join(ROOT, ".env") });

function readEnv(name) {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return process.env[name];
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.match(new RegExp(`^\\s*${name}\\s*=`)));
  if (!line) return process.env[name];
  const v = line.split("=", 2)[1]?.trim().replace(/^["']|["']$/g, "");
  return v || process.env[name];
}

function run(label, command, args = []) {
  console.log(`\n>> ${label}`);
  const r = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });
  if (r.status !== 0) {
    console.error(`\n[failed] ${label} (exit ${r.status ?? "unknown"})`);
    process.exit(r.status ?? 1);
  }
}

const dbUrl = readEnv("DATABASE_URL");
if (!dbUrl) {
  console.error("[!!] DATABASE_URL missing in .env — copy from .env.example");
  process.exit(1);
}
if (/^file:/i.test(dbUrl) || /sqlite/i.test(dbUrl)) {
  console.error("[!!] DATABASE_URL must be postgresql:// (not SQLite file:)");
  console.error("     Run: docker compose up -d");
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
  console.error("[!!] DATABASE_URL must start with postgresql:// or postgres://");
  process.exit(1);
}

console.log("=== DB init (PostgreSQL) ===");
console.log(`DATABASE_URL: ${dbUrl.slice(0, 48)}...`);

run("npm install (if needed)", "npm", ["install"]);
run("prisma generate", "npm", ["run", "db:generate"]);
run("prisma db push", "npm", ["run", "db:push"]);
run("db seed + corpus ingest", "npm", ["run", "db:seed"]);

console.log("\n[ok] Database ready. Start app: npm run dev");
console.log("Optional: npm run corpus:rag-init (embeddings for RAG)");
