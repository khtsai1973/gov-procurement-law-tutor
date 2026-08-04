/**
 * Prompt Injection 防護（相容層）。
 * 實作已收斂至 `src/lib/defense` 多層防禦體系；本檔保留既有測試匯入路徑。
 */
export {
  classifyInput,
  detectPromptInjection,
  fenceAsData,
  PROMPT_INJECTION_SYSTEM_ADDENDUM,
  sanitizeUserText,
  type InputGuardResult,
} from "@/lib/defense/input-guard";
