import prisma from "@/lib/prisma";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/** 補齊 TEACHER 角色與 UnitMaterial 資料表（幂等） */
export async function ensureTeacherSchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'Role' AND e.enumlabel = 'TEACHER'
        ) THEN
          ALTER TYPE "Role" ADD VALUE 'TEACHER';
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UnitMaterial" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT '政府採購全生命週期概論',
        "unitCode" TEXT,
        "summary" TEXT,
        "content" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "published" BOOLEAN NOT NULL DEFAULT false,
        "authorId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UnitMaterial_pkey" PRIMARY KEY ("id")
      )
    `);

    // 分兩步：先可空再補預設，降低 Neon／連線池對「ADD NOT NULL」的偶發失敗
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "UnitMaterial"
      ADD COLUMN IF NOT EXISTS "category" TEXT
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "UnitMaterial"
      SET "category" = '政府採購全生命週期概論'
      WHERE "category" IS NULL OR BTRIM("category") = ''
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "UnitMaterial"
      ALTER COLUMN "category" SET DEFAULT '政府採購全生命週期概論'
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "UnitMaterial"
      ALTER COLUMN "category" SET NOT NULL
    `);

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "UnitMaterial"
          ADD CONSTRAINT "UnitMaterial_authorId_fkey"
          FOREIGN KEY ("authorId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UnitMaterial_published_sortOrder_idx" ON "UnitMaterial"("published", "sortOrder")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UnitMaterial_published_category_sortOrder_idx" ON "UnitMaterial"("published", "category", "sortOrder")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UnitMaterial_category_idx" ON "UnitMaterial"("category")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UnitMaterial_authorId_idx" ON "UnitMaterial"("authorId")`,
    );

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UnitMaterial" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL'`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UnitMaterial" ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'NONE'`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UnitMaterial" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3)`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "UnitMaterial" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "UnitMaterial_source_reviewStatus_idx" ON "UnitMaterial"("source", "reviewStatus")`,
    );

    ensured = true;
  })().finally(() => {
    if (!ensured) ensurePromise = null;
  });

  return ensurePromise;
}
