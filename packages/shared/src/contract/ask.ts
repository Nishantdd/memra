import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import { ASK } from "../constants/ask.ts";
import { Uuid } from "../schemas/common.ts";

export const AskSource = z.object({
  n: z.number().int().positive(),
  noteId: Uuid,
  displayTitle: z.string(),
  folderName: z.string().nullable(),
  similarity: z.number().min(0).max(1),
});
export type AskSource = z.infer<typeof AskSource>;

export const AskEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meta"),
    provider: z.string(),
    model: z.string().nullable(),
    local: z.boolean(),
    extractive: z.boolean(),
    sources: z.array(AskSource),
  }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("done"), cached: z.boolean() }),
  z.object({ type: z.literal("insufficient"), topSimilarity: z.number().min(0).max(1) }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type AskEvent = z.infer<typeof AskEvent>;

export const AskInput = z.object({
  q: z.string().trim().min(ASK.minQueryLength).max(ASK.maxQueryLength),
  folderId: Uuid.nullable().default(null),
});
export type AskInput = z.infer<typeof AskInput>;

export const askContract = {
  answer: oc
    .route({ method: "POST", path: "/ask" })
    .errors({
      SERVICE_UNAVAILABLE: {},
      TOO_MANY_REQUESTS: { data: z.object({ retryAfterSec: z.number().int() }) },
    })
    .input(AskInput)
    .output(eventIterator(AskEvent)),
};
