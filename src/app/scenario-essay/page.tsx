import Link from "next/link";

import { ScenarioEssayPanel } from "@/components/ScenarioEssayPanel";
import { getSession } from "@/lib/get-session";
import { listScenarioEssayQuestions } from "@/lib/scenario-essay-bank";

export const dynamic = "force-dynamic";

export default async function ScenarioEssayPage() {
  const session = await getSession();
  const questions = listScenarioEssayQuestions();

  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        <Link href="/mock-exam" className="no-underline hover:underline">
          ← 模擬考試
        </Link>
        {" · "}
        <Link href="/question-bank" className="no-underline hover:underline">
          題庫選擇題練習
        </Link>
      </p>
      <ScenarioEssayPanel questions={questions} signedIn={Boolean(session?.user?.id)} />
    </section>
  );
}
