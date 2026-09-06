import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FactsConfig, FactsRequest } from '@roon-screen-cover/shared';
import { CodexFactsService } from './codexFacts.js';
import {
  type CodexResearchClient,
  type CodexResearchRequest,
  type CodexResearchResult,
} from './codexResearchTypes.js';

const CACHE_PATH = path.join(process.cwd(), 'test-codex-facts-service-cache.json');
const NOW = 2_000_000_000_000;
const config: FactsConfig = {
  provider: 'codex',
  model: 'gpt-5.6-luna',
  apiKey: '',
  factsCount: 3,
  rotationInterval: 30,
  prompt: 'Write sourced artist, album, and track facts',
};

function metadata(title: string, album = 'Album', artist = 'Artist'): FactsRequest {
  return { artist, album, title };
}

function generalResult(label = 'Research'): CodexResearchResult {
  const sourceUrl = 'https://example.com/interview';
  return {
    facts: Array.from({ length: 5 }, (_, index) => ({
      text: `${label} fact ${index}`,
      scope: index % 2 === 0 ? 'album' as const : 'artist' as const,
      trackTitle: null,
      sourceUrls: [sourceUrl],
    })),
    sources: [{ url: sourceUrl, title: 'Interview' }],
    webSearches: 2,
    openPages: 1,
    durationMs: 120,
    inputTokens: 40,
    outputTokens: 20,
  };
}

class FakeResearchClient implements CodexResearchClient {
  accountKey = 'account-a';
  requests: CodexResearchRequest[] = [];
  cancelCalls = 0;
  handler: (request: CodexResearchRequest) => Promise<CodexResearchResult> = async () => generalResult();

  async getResearchAccountKey(): Promise<string> {
    return this.accountKey;
  }

  async research(request: CodexResearchRequest): Promise<CodexResearchResult> {
    this.requests.push(request);
    return this.handler(request);
  }

  async cancelResearch(): Promise<void> {
    this.cancelCalls += 1;
  }
}

describe('CodexFactsService', () => {
  let client: FakeResearchClient;
  let service: CodexFactsService;

  beforeEach(() => {
    fs.rmSync(CACHE_PATH, { force: true });
    client = new FakeResearchClient();
    service = new CodexFactsService({ client, cachePath: CACHE_PATH, now: () => NOW });
  });

  afterEach(async () => {
    await service.invalidate();
    fs.rmSync(CACHE_PATH, { force: true });
  });

  it('researches once for twelve tracks on an album and rotates reusable facts deterministically', async () => {
    const responses = [];
    for (let index = 0; index < 12; index += 1) {
      responses.push(await service.generate(metadata(`Track ${index}`), config));
    }

    expect(client.requests).toHaveLength(1);
    expect(client.requests[0].focus).toBe('album');
    expect(client.requests[0].factsCount).toBe(3);
    expect(responses[0].research).toEqual({
      cache: 'miss', webSearches: 2, openPages: 1, durationMs: 120, inputTokens: 40, outputTokens: 20,
    });
    expect(responses.slice(1).every((response) => response.research?.cache === 'album')).toBe(true);
    expect(new Set(responses.map((response) => response.facts.join('|'))).size).toBeGreaterThan(1);
    expect(responses.every((response) => response.sources?.length === response.facts.length)).toBe(true);
  });

  it('coalesces concurrent requests for different tracks on the same album', async () => {
    let resolveResearch!: (result: CodexResearchResult) => void;
    client.handler = () => new Promise((resolve) => { resolveResearch = resolve; });

    const first = service.generate(metadata('First'), config);
    const second = service.generate(metadata('Second'), config);
    await vi.waitFor(() => expect(client.requests).toHaveLength(1));
    resolveResearch(generalResult());

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.research?.cache).toBe('miss');
    expect(secondResponse.research?.cache).toBe('miss');
    expect(firstResponse.research?.webSearches).toBe(2);
    expect(secondResponse.research?.webSearches).toBe(2);
  });

  it('separates research by artist and album identity', async () => {
    await service.generate(metadata('One', 'Album A', 'Artist A'), config);
    await service.generate(metadata('Two', 'Album B', 'Artist A'), config);
    await service.generate(metadata('Three', 'Album A', 'Artist B'), config);

    expect(client.requests).toHaveLength(3);
  });

  it('forwards display fact counts unchanged to the runtime protocol', async () => {
    await service.generate(metadata('One'), { ...config, factsCount: 1 });
    await service.generate(metadata('Five'), { ...config, factsCount: 5 });

    expect(client.requests.map((request) => request.factsCount)).toEqual([1, 5]);
  });

  it('never serves a track-scoped fact for a different title', async () => {
    client.handler = async (request) => {
      const sourceUrl = 'https://example.com/tracks';
      return {
        facts: [{
          text: request.focus === 'album' ? 'Only about Other Track' : `Only about ${request.title}`,
          scope: 'track',
          trackTitle: request.focus === 'album' ? 'Other Track' : request.title,
          sourceUrls: [sourceUrl],
        }],
        sources: [{ url: sourceUrl, title: 'Track notes' }],
        webSearches: 1,
        openPages: 1,
        durationMs: 50,
      };
    };

    const response = await service.generate(metadata('Requested Track'), config);
    expect(client.requests.map((request) => request.focus)).toEqual(['album', 'track']);
    expect(response.facts).toEqual(['Only about Requested Track']);
    expect(response.facts).not.toContain('Only about Other Track');
    expect(response.research).toEqual({ cache: 'miss', webSearches: 2, openPages: 2, durationMs: 100 });
  });

  it.each([
    ['album usage is unknown', undefined, 20],
    ['track usage is unknown', 40, undefined],
  ] as const)('omits partial token totals when %s', async (_label, albumTokens, trackTokens) => {
    client.handler = async (request) => {
      const sourceUrl = 'https://example.com/tracks';
      const tokens = request.focus === 'album' ? albumTokens : trackTokens;
      return {
        facts: [{
          text: request.focus === 'album' ? 'Only about Other Track' : `Only about ${request.title}`,
          scope: 'track',
          trackTitle: request.focus === 'album' ? 'Other Track' : request.title,
          sourceUrls: [sourceUrl],
        }],
        sources: [{ url: sourceUrl, title: 'Track notes' }],
        webSearches: 1,
        openPages: 1,
        durationMs: 50,
        inputTokens: tokens,
        outputTokens: tokens,
      };
    };

    const response = await service.generate(metadata('Requested Track'), config);
    expect(response.research).not.toHaveProperty('inputTokens');
    expect(response.research).not.toHaveProperty('outputTokens');
    expect(response.research).toMatchObject({ webSearches: 2, openPages: 2, durationMs: 100 });
  });

  it('ignores output caps, reasoning, API keys, and rotation in cache fingerprints', async () => {
    await service.generate(metadata('Track'), config);
    const response = await service.generate(metadata('Track'), {
      ...config,
      apiKey: 'unused-api-key',
      rotationInterval: 120,
      maxOutputTokens: 1,
      openaiReasoningEffort: 'xhigh',
    });

    expect(client.requests).toHaveLength(1);
    expect(response.research?.cache).toBe('track');
  });

  it('isolates account and generation configuration changes', async () => {
    await service.generate(metadata('Track'), config);
    await service.generate(metadata('Track'), { ...config, model: 'gpt-5.6-terra' });
    await service.generate(metadata('Track'), { ...config, prompt: 'Different instructions' });
    await service.generate(metadata('Track'), { ...config, factsCount: 2 });
    client.accountKey = 'account-b';
    await service.generate(metadata('Track'), config);

    expect(client.requests).toHaveLength(5);
    expect(client.cancelCalls).toBe(1);
    expect(client.requests.at(-1)?.accountKey).toBe('account-b');
  });

  it('discards late research when the account changes', async () => {
    let resolveResearch!: (result: CodexResearchResult) => void;
    client.handler = () => new Promise((resolve) => { resolveResearch = resolve; });
    const pending = service.generate(metadata('Track'), config);
    await vi.waitFor(() => expect(client.requests).toHaveLength(1));
    client.accountKey = 'account-b';
    resolveResearch(generalResult('Old account'));

    await expect(pending).rejects.toMatchObject({ code: 'canceled' });
    client.handler = async () => generalResult('New account');
    const current = await service.generate(metadata('Track'), config);
    expect(current.facts.every((fact) => fact.startsWith('New account'))).toBe(true);
    expect(client.requests).toHaveLength(2);
  });

  it('does not let a stalled preflight adopt an epoch invalidated by a configuration change', async () => {
    let resolveAccount!: (accountKey: string) => void;
    const getAccount = vi.spyOn(client, 'getResearchAccountKey')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveAccount = resolve; }))
      .mockImplementation(async () => client.accountKey);
    const pending = service.generate(metadata('Track'), config);
    await vi.waitFor(() => expect(getAccount).toHaveBeenCalledTimes(1));

    await service.invalidate();
    resolveAccount(client.accountKey);

    await expect(pending).rejects.toMatchObject({ code: 'canceled' });
    expect(client.requests).toHaveLength(0);
  });

  it('does not adopt an external invalidation while awaiting account-change cancellation', async () => {
    await service.generate(metadata('Initial'), config);
    client.requests = [];
    client.accountKey = 'account-b';
    let releaseCancellation!: () => void;
    const cancellation = new Promise<void>((resolve) => { releaseCancellation = resolve; });
    const cancelResearch = vi.spyOn(client, 'cancelResearch').mockImplementation(() => cancellation);

    const pending = service.generate(metadata('Changed account'), config);
    await vi.waitFor(() => expect(cancelResearch).toHaveBeenCalledTimes(1));
    const externalInvalidation = service.invalidate();
    await vi.waitFor(() => expect(cancelResearch).toHaveBeenCalledTimes(2));
    releaseCancellation();
    await externalInvalidation;

    await expect(pending).rejects.toMatchObject({ code: 'canceled' });
    expect(client.requests).toHaveLength(0);
  });

  it('does not adopt disposal while awaiting account-change cancellation', async () => {
    await service.generate(metadata('Initial'), config);
    client.requests = [];
    client.accountKey = 'account-b';
    let releaseCancellation!: () => void;
    const cancellation = new Promise<void>((resolve) => { releaseCancellation = resolve; });
    const cancelResearch = vi.spyOn(client, 'cancelResearch').mockImplementation(() => cancellation);

    const pending = service.generate(metadata('Changed account'), config);
    await vi.waitFor(() => expect(cancelResearch).toHaveBeenCalledTimes(1));
    const disposal = service.dispose();
    await vi.waitFor(() => expect(cancelResearch).toHaveBeenCalledTimes(2));
    releaseCancellation();
    await disposal;

    await expect(pending).rejects.toMatchObject({ code: 'unavailable' });
    expect(client.requests).toHaveLength(0);
  });

  it('forces fresh research, coalesces concurrent forced requests, and publishes the fresh result to the normal cache', async () => {
    let generation = 0;
    client.handler = async () => generalResult(`Generation ${generation += 1}`);
    const initial = await service.generate(metadata('Track'), config);
    expect((await service.generate(metadata('Track'), config)).facts).toEqual(initial.facts);

    const [forcedA, forcedB] = await Promise.all([
      service.generate(metadata('Track'), config, { force: true }),
      service.generate(metadata('Track'), config, { force: true }),
    ]);
    expect(client.requests).toHaveLength(2);
    expect(forcedA.facts).toEqual(forcedB.facts);
    expect(forcedA.facts).not.toEqual(initial.facts);
    const cached = await service.generate(metadata('Track'), config);
    expect(cached.facts).toEqual(forcedA.facts);
    expect(cached.research?.cache).toBe('track');
  });

  it('reselects other tracks from forced album research without another research call', async () => {
    let generation = 0;
    client.handler = async () => generalResult(`Generation ${generation += 1}`);
    await service.generate(metadata('Track A'), config);
    const oldB = await service.generate(metadata('Track B'), config);
    expect(oldB.facts.every((fact) => fact.startsWith('Generation 1'))).toBe(true);
    expect(client.requests).toHaveLength(1);

    await service.generate(metadata('Track A'), config, { force: true });
    const refreshedB = await service.generate(metadata('Track B'), config);

    expect(refreshedB.facts.every((fact) => fact.startsWith('Generation 2'))).toBe(true);
    expect(refreshedB.research?.cache).toBe('album');
    expect(client.requests).toHaveLength(2);
    expect(refreshedB.generatedAt).toBe(oldB.generatedAt);
  });

  it('preserves reusable research when disposed for shutdown', async () => {
    const initial = await service.generate(metadata('Track'), config);
    await service.dispose();
    await expect(service.generate(metadata('Other'), config)).rejects.toMatchObject({ code: 'unavailable' });
    const reloadedClient = new FakeResearchClient();
    service = new CodexFactsService({ client: reloadedClient, cachePath: CACHE_PATH, now: () => NOW });

    const cached = await service.generate(metadata('Track'), config);
    expect(cached.facts).toEqual(initial.facts);
    expect(cached.research?.cache).toBe('track');
    expect(reloadedClient.requests).toHaveLength(0);
  });

  it('does not cache failed or unattributed research', async () => {
    client.handler = async () => ({
      ...generalResult(),
      facts: [{
        text: 'Unsupported', scope: 'album', trackTitle: null, sourceUrls: ['https://foreign.example/source'],
      }],
    });

    await expect(service.generate(metadata('Track'), config)).rejects.toMatchObject({ code: 'no-sources' });
    await expect(service.generate(metadata('Track'), config)).rejects.toMatchObject({ code: 'no-sources' });
    expect(client.requests).toHaveLength(2);
  });

  it('rejects source-linked facts whose URL is not public', async () => {
    client.handler = async () => ({
      ...generalResult(),
      facts: [{
        text: 'Private source', scope: 'album', trackTitle: null, sourceUrls: ['https://localhost/source'],
      }],
      sources: [{ url: 'https://localhost/source', title: 'Private' }],
    });

    await expect(service.generate(metadata('Track'), config)).rejects.toMatchObject({ code: 'no-sources' });
  });

  it('allows one active job and four queued jobs, then fails fast as busy', async () => {
    client.handler = () => new Promise(() => undefined);
    const accepted = Array.from({ length: 5 }, (_, index) => service.generate(
      metadata('Track', `Album ${index}`), config,
    ));
    const acceptedAssertions = accepted.map(async (promise) => {
      await expect(promise).rejects.toMatchObject({ code: 'canceled' });
    });
    const rejected = service.generate(metadata('Track', 'Album 5'), config);

    await expect(rejected).rejects.toMatchObject({ code: 'busy' });
    await vi.waitFor(() => expect(client.requests).toHaveLength(1));
    await service.invalidate();
    await Promise.all(acceptedAssertions);
    expect(client.requests[0].signal?.aborted).toBe(true);
    expect(client.cancelCalls).toBeGreaterThan(0);
  });
});
