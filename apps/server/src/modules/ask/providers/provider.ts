export interface LlmStreamInput {
  system: string;
  user: string;
  maxTokens: number;
  signal: AbortSignal;
}

export interface LlmProvider {
  readonly providerName: "none" | "openai-compatible";
  readonly model: string | null;
  readonly local: boolean;
  stream(input: LlmStreamInput): AsyncIterable<string>;
}
