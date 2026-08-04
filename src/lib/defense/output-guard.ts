/**
 * 輸出層（Output Guardrails）：對 LLM／回覆文本做敏感內容與機密外洩二次檢核。
 */

import { OFF_TOPIC_REPLY } from "@/lib/topic-scope";

export type OutputGuardResult = {
  ok: boolean;
  /** 通過檢核後可對外顯示的文字（失敗時為安全替代文） */
  text: string;
  matches: string[];
  reason?: string;
};

type Rule = { id: string; re: RegExp };

/** 系統／金鑰外洩 */
const SECRET_LEAK_RULES: Rule[] = [
  { id: "openai-sk", re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { id: "openai-proj", re: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/ },
  { id: "aws-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "bearer-token", re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/i },
  { id: "postgres-url", re: /\bpostgres(ql)?:\/\/[^\s]+/i },
  { id: "mysql-url", re: /\bmysql:\/\/[^\s]+/i },
  { id: "env-secret", re: /\b(AUTH_SECRET|NEXTAUTH_SECRET|OPENAI_API_KEY|DATABASE_URL|QUESTION_BANK_REIMPORT_SECRET)\s*[=:：]\s*\S+/i },
  { id: "private-key", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

/** 疑似把系統提示原文倒出 */
const PROMPT_LEAK_RULES: Rule[] = [
  { id: "dump-system", re: /我的系統提示(詞|原文)?[：:]\s*.{20,}/ },
  { id: "dump-sys-en", re: /here\s+is\s+(my\s+)?(system\s+)?(prompt|instructions?)\s*[:：]/i },
  { id: "internal-fence", re: /<<\s*SYSTEM_ANALYSIS_GUIDANCE\s*>>|<<\s*RETRIEVED_REGULATION_FRAGMENTS\s*>>/ },
];

/**
 * 明顯違法操作性建議（非採購法規罰則教學）。
 * 刻意避開單獨的「罰則／停權／詐欺」等教學用語。
 */
const HARMFUL_ADVICE_RULES: Rule[] = [
  { id: "weapon", re: /(如何|怎麼|教我).{0,12}(自製|製造|組裝).{0,12}(炸彈|爆裂物|槍械|毒品)/ },
  { id: "evade-crime", re: /(如何|怎麼).{0,16}(不被抓|逃避偵查|銷毀證據).{0,20}(犯罪|洗錢|行賄)/ },
  { id: "hack-guide", re: /(如何|怎麼|步驟).{0,12}(入侵|駭入|破解).{0,12}(系統|資料庫|伺服器|密碼)/ },
  { id: "malware", re: /(撰寫|製作).{0,8}(勒索軟體|木馬|病毒).{0,12}(教學|步驟|程式碼)/ },
];

const SAFE_BLOCKED_REPLY =
  "此回答未通過安全檢核，已攔截。請改以政府採購法規用語重新提問。";

function collectMatches(text: string, rules: Rule[]): string[] {
  const hits: string[] = [];
  for (const rule of rules) {
    if (rule.re.test(text)) hits.push(rule.id);
  }
  return hits;
}

/**
 * 對模型輸出做二次檢核；命中則改寫為安全回覆。
 */
export function guardModelOutput(text: string): OutputGuardResult {
  const raw = (text ?? "").trim();
  if (!raw) {
    return { ok: true, text: OFF_TOPIC_REPLY, matches: [] };
  }

  const matches = [
    ...collectMatches(raw, SECRET_LEAK_RULES),
    ...collectMatches(raw, PROMPT_LEAK_RULES),
    ...collectMatches(raw, HARMFUL_ADVICE_RULES),
  ];

  if (matches.length === 0) {
    return { ok: true, text: raw, matches: [] };
  }

  const reason = matches.some((m) =>
    SECRET_LEAK_RULES.some((r) => r.id === m) || PROMPT_LEAK_RULES.some((r) => r.id === m),
  )
    ? "output-sensitive-leak"
    : "output-harmful-advice";

  return {
    ok: false,
    text: SAFE_BLOCKED_REPLY,
    matches,
    reason,
  };
}

export { SAFE_BLOCKED_REPLY };
