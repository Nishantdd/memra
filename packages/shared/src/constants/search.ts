export const SEARCH = {
  minQueryKeyword: 2,
  minQuerySemantic: 3,
  maxQueryLength: 500,
  panelResults: 8,
  pageResults: 20,
  maxResults: 100,
  debounceKeywordMs: 150,
  debounceSemanticMs: 400,
  snippetTokens: 24,
} as const;

export const SEARCH_MODES = ["keyword", "semantic"] as const;
