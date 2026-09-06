import type { FactSource, FactsRequest } from '@roon-screen-cover/shared';

export interface SourcedResearchFact {
  text: string;
  scope: 'artist' | 'album' | 'track';
  trackTitle: string | null;
  sourceUrls: string[];
}

export interface CodexResearchRequest extends FactsRequest {
  accountKey: string;
  model: string;
  prompt: string;
  factsCount: number;
  focus: 'album' | 'track';
  signal?: AbortSignal;
}

export interface CodexResearchResult {
  facts: SourcedResearchFact[];
  sources: FactSource[];
  webSearches: number;
  openPages: number;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

/** Internal account-scoped research; never a raw RPC proxy. */
export interface CodexResearchClient {
  getResearchAccountKey(): Promise<string>;
  research(request: CodexResearchRequest): Promise<CodexResearchResult>;
  cancelResearch(): Promise<void>;
}

const RESEARCH_ERRORS = {
  'not-connected': 'Connect a ChatGPT account in AI Facts settings to research music facts.',
  unavailable: 'ChatGPT research is unavailable. Check the account connection and try again.',
  'model-unavailable': 'The selected model is unavailable for this account or does not support the required reasoning setting.',
  busy: 'Music research is busy. Please try again shortly.',
  timeout: 'Music research took too long. Please try again.',
  canceled: 'Music research was cancelled because the account or settings changed.',
  'invalid-output': 'The research response was incomplete or could not be used. Please try again.',
  'no-sources': 'No usable facts with source attribution were found for this music.',
} as const;

export class CodexResearchError extends Error {
  constructor(readonly code: keyof typeof RESEARCH_ERRORS) {
    super(RESEARCH_ERRORS[code]);
    this.name = 'CodexResearchError';
  }
}
