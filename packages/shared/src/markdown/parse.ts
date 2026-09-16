import type { Root, RootContent } from "mdast";
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

const CONTAINERS = new Set([
  "list",
  "listItem",
  "blockquote",
  "table",
  "tableRow",
  "footnoteDefinition",
]);

function collectBlocks(node: RootContent, out: string[]): void {
  if (CONTAINERS.has(node.type) && "children" in node) {
    for (const child of node.children as RootContent[]) collectBlocks(child, out);
    return;
  }
  const text = normalizeText(toString(node));
  if (text) out.push(text);
}

export function toPlainText(tree: Root): string {
  const blocks: string[] = [];
  for (const node of tree.children) collectBlocks(node, blocks);
  return blocks.join("\n");
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
