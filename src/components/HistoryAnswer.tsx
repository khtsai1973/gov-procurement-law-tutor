"use client";

import { AnswerWithCitations } from "@/components/AnswerWithCitations";
import { parseCitationsJson } from "@/lib/chat-citations";

type HistoryAnswerProps = {
  answer: string;
  sourcesJson: string | null;
};

export function HistoryAnswer({ answer, sourcesJson }: HistoryAnswerProps) {
  const citations = parseCitationsJson(sourcesJson);
  return <AnswerWithCitations answer={answer} citations={citations} />;
}
