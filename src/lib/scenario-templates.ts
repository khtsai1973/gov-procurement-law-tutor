/**
 * @deprecated 請改用 `@/lib/guided-prompts`（GUIDED_SCENARIOS）。
 * 保留此檔以相容舊 import。
 */

import { guidedAsScenarioTemplates, type GuidedScenario } from "@/lib/guided-prompts";

export type ScenarioTemplate = {
  id: string;
  label: string;
  body: string;
};

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = guidedAsScenarioTemplates();

export type { GuidedScenario };
