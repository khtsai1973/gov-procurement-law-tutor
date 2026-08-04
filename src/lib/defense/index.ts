/**
 * 多層資安防禦體系（Defense in Depth）入口。
 *
 * 1. 輸入層 Input：classifyInput / detectPromptInjection
 * 2. 模型層 Model：結構化 JSON Schema + 嚴格 system prompt addendum
 * 3. 輸出層 Output：guardModelOutput
 */

export {
  classifyInput,
  detectPromptInjection,
  extractQuestionFromJsonBody,
  fenceAsData,
  PROMPT_INJECTION_SYSTEM_ADDENDUM,
  sanitizeUserText,
  type InputGuardResult,
} from "@/lib/defense/input-guard";

export {
  guardModelOutput,
  SAFE_BLOCKED_REPLY,
  type OutputGuardResult,
} from "@/lib/defense/output-guard";

export {
  formatGroundedAnswerJson,
  GROUNDED_ANSWER_JSON_SCHEMA,
  GroundedAnswerSchema,
  parseGroundedAnswerJson,
  type GroundedAnswerJson,
} from "@/lib/defense/structured-answer";
