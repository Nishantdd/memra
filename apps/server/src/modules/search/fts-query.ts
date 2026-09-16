const PHRASE_OR_TERM = /"([^"]+)"|(\S+)/g;

export interface FtsQuery {
  /** Every term required (AND). */
  strict: string;
  /** Any term matches (OR); used as a fallback when strict yields nothing. */
  loose: string;
  terms: string[];
}

const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Builds FTS5 MATCH expressions from free text. User input is never passed
 * through as FTS syntax: every token is quoted; the last token gets a prefix
 * wildcard so results update while typing.
 */
export function buildFtsQuery(raw: string, prefixLast = true): FtsQuery | null {
  const parts: { text: string; phrase: boolean }[] = [];
  for (const m of raw.normalize("NFC").matchAll(PHRASE_OR_TERM)) {
    const phrase = m[1] !== undefined;
    const text = (m[1] ?? m[2] ?? "").replace(/[^\p{L}\p{N}\s_-]/gu, " ").trim();
    if (text) parts.push({ text, phrase });
  }
  if (parts.length === 0) return null;

  const tokens = parts.map((p, i) => {
    const q = quote(p.text);
    return prefixLast && i === parts.length - 1 && !p.phrase ? `${q}*` : q;
  });
  return {
    strict: tokens.join(" AND "),
    loose: tokens.join(" OR "),
    terms: parts.map((p) => p.text.toLowerCase()),
  };
}
