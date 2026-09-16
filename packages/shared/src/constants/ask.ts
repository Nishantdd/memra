export const ASK = {
  minQueryLength: 3,
  maxQueryLength: 500,
  /** Best-note similarity required before generating an answer. */
  minTopSimilarity: 0.45,
  maxSourceNotes: 5,
  chunksPerNote: 2,
  contextTokenBudget: 2500,
  maxAnswerTokens: 400,
  extractiveSnippets: 3,
  cacheTtlMs: 10 * 60_000,
} as const;
