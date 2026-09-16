import type { Root } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const processor = unified().use(remarkParse).use(remarkGfm);

export function parseMarkdown(md: string): Root {
  return processor.parse(md);
}

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function toPlainText(tree: Root): string {
  return tree.children
    .map((node) => normalizeText(toString(node)))
    .filter(Boolean)
    .join("\n");
}

export function firstHeading(tree: Root): string | null {
  for (const node of tree.children) {
    if (node.type === "heading") {
      const text = normalizeText(toString(node));
      if (text) return text;
    }
  }
  return null;
}

export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max / 2 ? cut.slice(0, space) : cut).trimEnd();
}

export interface DerivedFields {
  bodyPlain: string;
  displayTitle: string;
  excerpt: string;
}

export function deriveFields(title: string, bodyMd: string): DerivedFields {
  const tree = parseMarkdown(bodyMd);
  const bodyPlain = toPlainText(tree);
  const trimmedTitle = normalizeText(title);
  const displayTitle =
    trimmedTitle ||
    firstHeading(tree) ||
    cutAtWord(bodyPlain.replace(/\n/g, " "), 60) ||
    "Untitled";
  return { bodyPlain, displayTitle, excerpt: cutAtWord(bodyPlain.replace(/\n/g, " "), 280) };
}
