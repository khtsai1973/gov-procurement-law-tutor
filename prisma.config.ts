import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Prisma CLI does not always auto-load .env on Windows; load explicitly.
const root = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(root, ".env") });

export default defineConfig({
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
