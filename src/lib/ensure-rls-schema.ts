import prisma from "@/lib/prisma";

let ensured = false;
let ensurePromise: Promise<void> | null = null;

/**
 * 啟用使用者資料表 Row Level Security（防禦縱深）。
 * - 政策依 app.current_user_id / app.rls_bypass 判定
 * - 預設不 FORCE（Postgres 表擁有者仍可維運／seed）；設 ENABLE_FORCE_RLS=true 時強制套用
 * - 應用層請搭配 withUserRls / withRlsBypass
 */
export async function ensureRlsSchema(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    const force = process.env.ENABLE_FORCE_RLS === "true" || process.env.ENABLE_FORCE_RLS === "1";

    // UserQuestion
    await prisma.$executeRawUnsafe(`ALTER TABLE "UserQuestion" ENABLE ROW LEVEL SECURITY`);
    if (force) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "UserQuestion" FORCE ROW LEVEL SECURITY`);
    }
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS user_question_isolation ON "UserQuestion"`);
    await prisma.$executeRawUnsafe(`
      CREATE POLICY user_question_isolation ON "UserQuestion"
      FOR ALL
      USING (
        current_setting('app.rls_bypass', true) = 'on'
        OR "userId" = current_setting('app.current_user_id', true)
      )
      WITH CHECK (
        current_setting('app.rls_bypass', true) = 'on'
        OR "userId" = current_setting('app.current_user_id', true)
      )
    `);

    // MockExamSession
    await prisma.$executeRawUnsafe(`ALTER TABLE "MockExamSession" ENABLE ROW LEVEL SECURITY`);
    if (force) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "MockExamSession" FORCE ROW LEVEL SECURITY`);
    }
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS mock_exam_session_isolation ON "MockExamSession"`);
    await prisma.$executeRawUnsafe(`
      CREATE POLICY mock_exam_session_isolation ON "MockExamSession"
      FOR ALL
      USING (
        current_setting('app.rls_bypass', true) = 'on'
        OR "userId" = current_setting('app.current_user_id', true)
      )
      WITH CHECK (
        current_setting('app.rls_bypass', true) = 'on'
        OR "userId" = current_setting('app.current_user_id', true)
      )
    `);

    // MockExamSessionAnswer（經由場次擁有者）
    await prisma.$executeRawUnsafe(`ALTER TABLE "MockExamSessionAnswer" ENABLE ROW LEVEL SECURITY`);
    if (force) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "MockExamSessionAnswer" FORCE ROW LEVEL SECURITY`,
      );
    }
    await prisma.$executeRawUnsafe(
      `DROP POLICY IF EXISTS mock_exam_answer_isolation ON "MockExamSessionAnswer"`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE POLICY mock_exam_answer_isolation ON "MockExamSessionAnswer"
      FOR ALL
      USING (
        current_setting('app.rls_bypass', true) = 'on'
        OR EXISTS (
          SELECT 1 FROM "MockExamSession" s
          WHERE s.id = "sessionId"
            AND s."userId" = current_setting('app.current_user_id', true)
        )
      )
      WITH CHECK (
        current_setting('app.rls_bypass', true) = 'on'
        OR EXISTS (
          SELECT 1 FROM "MockExamSession" s
          WHERE s.id = "sessionId"
            AND s."userId" = current_setting('app.current_user_id', true)
        )
      )
    `);

    // MockExamSupplement
    await prisma.$executeRawUnsafe(`ALTER TABLE "MockExamSupplement" ENABLE ROW LEVEL SECURITY`);
    if (force) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "MockExamSupplement" FORCE ROW LEVEL SECURITY`,
      );
    }
    await prisma.$executeRawUnsafe(
      `DROP POLICY IF EXISTS mock_exam_supplement_isolation ON "MockExamSupplement"`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE POLICY mock_exam_supplement_isolation ON "MockExamSupplement"
      FOR ALL
      USING (
        current_setting('app.rls_bypass', true) = 'on'
        OR "userId" = current_setting('app.current_user_id', true)
      )
      WITH CHECK (
        current_setting('app.rls_bypass', true) = 'on'
        OR "userId" = current_setting('app.current_user_id', true)
      )
    `);

    ensured = true;
  })().catch((err) => {
    // RLS 失敗不阻斷服務（例如無權 ALTER）；記錄後交由應用層權限把關
    console.warn("[ensure-rls-schema]", err instanceof Error ? err.message : err);
    ensured = true;
    ensurePromise = null;
  });

  return ensurePromise;
}
