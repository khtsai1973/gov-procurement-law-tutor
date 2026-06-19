import { z } from "zod";

export const questionBankEntrySchema = z.object({
  key: z.string().min(1),
  question: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  relatedSlugs: z.array(z.string().min(1)),
  hintAnswer: z.string().optional(),
  category: z.string().min(1),
});

export const questionBankFileSchema = z.object({
  version: z.number().optional(),
  items: z.array(questionBankEntrySchema),
});

export type QuestionBankEntry = z.infer<typeof questionBankEntrySchema>;

export type QuestionBankMatch = {
  keywords: string[];
  relatedSlugs: string[];
  hintAnswer?: string;
  matchedKeys: string[];
};
