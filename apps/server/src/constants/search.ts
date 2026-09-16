export const FTS_CANDIDATES = 50;
/** bm25 column weights: title, tags, body, folder. */
export const FTS_WEIGHTS = [10.0, 5.0, 1.0, 2.0] as const;
export const SNIPPET_START = "\u0001";
export const SNIPPET_END = "\u0002";
export const SNIPPET_ELLIPSIS = "…";
export const RRF_K = 60;
export const RRF_WEIGHT_KEYWORD = 1.0;
export const RRF_WEIGHT_SEMANTIC = 1.0;
