import prisma from "@/lib/prisma";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/** 補齊註冊申請表與 RegistrationStatus 枚舉（幂等） */
export async function ensureRegistrationSchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RegistrationApplication" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "name" TEXT,
        "requestedRole" "Role" NOT NULL,
        "note" TEXT,
        "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
        "reviewedAt" TIMESTAMP(3),
        "reviewedById" TEXT,
        "reviewNote" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RegistrationApplication_pkey" PRIMARY KEY ("id")
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "RegistrationApplication_email_key"
      ON "RegistrationApplication"("email")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "RegistrationApplication_status_createdAt_idx"
      ON "RegistrationApplication"("status", "createdAt")
    `);

    ensured = true;
  })().catch((err) => {
    console.warn(
      "[ensure-registration-schema]",
      err instanceof Error ? err.message : err,
    );
    ensurePromise = null;
    throw err;
  });

  return ensurePromise;
}
