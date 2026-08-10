import {
  hasTeachingExplanation,
  parseTeachingExplanation,
  TEACHING_EXPLANATION_SECTIONS,
} from "@/lib/teaching-explanation";

/** 將完整教學解析以七段標題呈現；無法解析時回退原文 */
export function TeachingExplanationView({
  hintAnswer,
  className = "",
}: {
  hintAnswer: string;
  className?: string;
}) {
  const parsed = parseTeachingExplanation(hintAnswer);
  if (!parsed || !hasTeachingExplanation(hintAnswer)) {
    return (
      <p className={`whitespace-pre-wrap text-[var(--muted)] ${className}`}>
        {hintAnswer}
      </p>
    );
  }

  return (
    <div className={`space-y-3 text-[var(--muted)] ${className}`}>
      {TEACHING_EXPLANATION_SECTIONS.map((key) => (
        <div key={key}>
          <p className="text-xs font-semibold text-[var(--fg)]">{key}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{parsed[key]}</p>
        </div>
      ))}
    </div>
  );
}
