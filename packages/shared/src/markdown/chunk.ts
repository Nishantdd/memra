import type { Heading, Root, RootContent } from "mdast";
import { toString } from "mdast-util-to-string";
import { getEncoding, type Tiktoken } from "js-tiktoken";
import { CHUNKING } from "../constants/chunking.ts";
import { normalizeText, parseMarkdown } from "./parse.ts";

export interface ChunkContext {
  displayTitle: string;
  folderName: string | null;
  tags: string[];
}

export interface Chunk {
  ord: number;
  headingPath: string;
  /** Text that is embedded: context header + display text. */
  text: string;
  /** Text shown to users and given to the LLM. */
  displayText: string;
  tokenCount: number;
}

let encoder: Tiktoken | null = null;
const enc = () => (encoder ??= getEncoding("cl100k_base"));

export const countTokens = (text: string): number => enc().encode(text).length;

function truncateTokens(text: string, max: number): string {
  const ids = enc().encode(text);
  return ids.length <= max ? text : enc().decode(ids.slice(0, max));
}

function tailTokens(text: string, max: number): string {
  const ids = enc().encode(text);
  return ids.length <= max ? text : enc().decode(ids.slice(ids.length - max));
}

function contextHeader(ctx: ChunkContext, headingPath: string): string {
  const lines = [`Title: ${ctx.displayTitle}`, `Folder: ${ctx.folderName ?? "Unfiled"}`];
  if (ctx.tags.length) lines.push(`Tags: ${ctx.tags.join(", ")}`);
  if (headingPath) lines.push(`Section: ${headingPath}`);
  return `${truncateTokens(lines.join("\n"), CHUNKING.headerMaxTokens)}\n\n`;
}

interface Section {
  headingPath: string;
  blocks: string[];
}

function blockText(node: RootContent): string[] {
  if (node.type === "list") {
    return node.children.map((item) => normalizeText(toString(item))).filter(Boolean);
  }
  if (node.type === "table") {
    return node.children
      .map((row) => normalizeText(row.children.map((c) => toString(c)).join(" | ")))
      .filter(Boolean);
  }
  const text = node.type === "code" ? node.value.trim() : normalizeText(toString(node));
  return text ? [text] : [];
}

function sections(tree: Root): Section[] {
  const out: Section[] = [];
  const stack: string[] = [];
  let current: Section = { headingPath: "", blocks: [] };
  const flush = () => {
    if (current.blocks.length) out.push(current);
  };
  for (const node of tree.children) {
    if (node.type === "heading" && node.depth <= CHUNKING.headingDepthMax) {
      flush();
      const h = node as Heading;
      stack.length = h.depth - 1;
      stack[h.depth - 1] = normalizeText(toString(h));
      current = { headingPath: stack.filter(Boolean).join(" > "), blocks: [] };
      continue;
    }
    current.blocks.push(...blockText(node));
  }
  flush();
  return out;
}

const SENTENCE = /(?<=[.!?])\s+/;

function splitOversized(block: string, budget: number): string[] {
  if (countTokens(block) <= budget) return [block];
  const pieces: string[] = [];
  let buffer = "";
  for (const sentence of block.split(SENTENCE)) {
    const candidate = buffer ? `${buffer} ${sentence}` : sentence;
    if (countTokens(candidate) > budget && buffer) {
      pieces.push(buffer);
      buffer = sentence;
    } else {
      buffer = candidate;
    }
  }
  if (buffer) pieces.push(buffer);
  return pieces.flatMap((p) => (countTokens(p) > budget ? [truncateTokens(p, budget)] : [p]));
}

function packBlocks(blocks: string[], budget: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;
  for (const block of blocks.flatMap((b) => splitOversized(b, budget))) {
    const tokens = countTokens(block) + 1;
    if (current.length && currentTokens + tokens > budget) {
      chunks.push(current.join("\n"));
      const overlap = tailTokens(current.at(-1)!, CHUNKING.overlapTokens);
      current = [overlap];
      currentTokens = countTokens(overlap) + 1;
    }
    current.push(block);
    currentTokens += tokens;
  }
  if (current.length) chunks.push(current.join("\n"));
  return chunks;
}

export function chunkNote(bodyMd: string, bodyPlain: string, ctx: ChunkContext): Chunk[] {
  const tree = parseMarkdown(bodyMd);
  const chunks: Chunk[] = [];
  const push = (headingPath: string, displayText: string) => {
    const text = contextHeader(ctx, headingPath) + displayText;
    chunks.push({
      ord: chunks.length,
      headingPath,
      text,
      displayText,
      tokenCount: countTokens(text),
    });
  };

  const summary = truncateTokens(bodyPlain.replace(/\n/g, " "), CHUNKING.summaryBodyTokens);
  push("", summary ? `${ctx.displayTitle}\n${summary}` : ctx.displayTitle);

  for (const section of sections(tree)) {
    const header = contextHeader(ctx, section.headingPath);
    const budget = Math.max(CHUNKING.maxTokens - countTokens(header), 50);
    for (const piece of packBlocks(section.blocks, budget)) push(section.headingPath, piece);
  }
  return chunks;
}
