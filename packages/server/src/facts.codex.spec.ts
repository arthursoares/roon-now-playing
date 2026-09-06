// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FactsConfig, FactsResponse } from '@roon-screen-cover/shared';
import { CodexResearchError } from './codexResearchTypes.js';

const mocks = vi.hoisted(() => ({
  config: {} as FactsConfig,
  apiGenerate: vi.fn(),
  cacheGet: vi.fn(),
}));
vi.mock('./factsConfig.js', async importOriginal => ({
  ...await importOriginal<typeof import('./factsConfig.js')>(),
  FactsConfigStore: class {
    get() { return { ...mocks.config }; }
    update(updates: Partial<FactsConfig>) { Object.assign(mocks.config, updates); }
  },
}));
vi.mock('./factsCache.js', () => ({
  FactsCache: class {
    getEntry() { return mocks.cacheGet(); }
    makeKey() { return 'api-cache-key'; }
    set() {}
  },
}));
vi.mock('./llm.js', () => ({ createLLMProvider: () => ({ generateFacts: mocks.apiGenerate }) }));

import { createFactsRouter } from './facts.js';

const metadata = { artist: 'Radiohead', album: 'In Rainbows', title: '15 Step' };
const sourcedResult: FactsResponse = {
  facts: ['A sourced album fact.'], cached: true, generatedAt: 1000,
  sources: [[{ url: 'https://www.radiohead.com/library/', title: 'Radiohead Public Library' }]],
  research: { cache: 'album', webSearches: 0, openPages: 0, durationMs: 0 },
};

describe('Codex facts route integration', () => {
  let server: Server;
  let base: string;
  const research = { generate: vi.fn(async () => sourcedResult), invalidate: vi.fn(async () => {}) };

  beforeEach(async () => {
    vi.clearAllMocks();
    Object.assign(mocks.config, {
      provider: 'codex', model: 'gpt-5.6-luna', apiKey: '', prompt: 'Useful music facts',
      factsCount: 5, rotationInterval: 25, maxOutputTokens: 1024,
    });
    mocks.apiGenerate.mockResolvedValue(['API fact']);
    mocks.cacheGet.mockReturnValue(null);
    const app = express();
    app.use(express.json());
    app.use('/api', createFactsRouter({ codexFacts: research }));
    app.use('/disabled', createFactsRouter());
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

  function request(endpoint: string, body: unknown, extra: Record<string, string> = {}) {
    return fetch(`${base}${endpoint}`, {
      method: 'POST', headers: {
        'content-type': 'application/json', ...extra,
      }, body: JSON.stringify(body),
    });
  }

  it('uses account-scoped research without an API key or the API-provider cache', async () => {
    mocks.cacheGet.mockReturnValue({ facts: ['Old account-less result'], timestamp: 1 });
    const response = await request('/api/facts', metadata);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sourcedResult);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(research.generate).toHaveBeenCalledWith(metadata, expect.objectContaining({ provider: 'codex', apiKey: '' }));
    expect(mocks.cacheGet).not.toHaveBeenCalled();
    expect(mocks.apiGenerate).not.toHaveBeenCalled();
  });

  it('does not silently fall back to a billed API provider when the runtime is absent', async () => {
    mocks.config.apiKey = 'an-existing-api-key';
    expect((await request('/disabled/facts', metadata)).status).toBe(503);
    expect(mocks.apiGenerate).not.toHaveBeenCalled();
  });

  it('keeps API-provider facts working without account authorization', async () => {
    mocks.config.provider = 'openai';
    mocks.config.apiKey = 'test-api-key';
    const response = await request('/api/facts', metadata);
    expect(response.status).toBe(200);
    expect((await response.json()).facts).toEqual(['API fact']);
    expect(research.generate).not.toHaveBeenCalled();
  });

  it.each([{ provider: 'openai' }, { prompt: 'Changed prompt' }, { maxOutputTokens: 2048 }])(
    'allows active subscription configuration changes without a bearer token: %j', async change => {
      expect((await request('/api/facts/config', change)).status).toBe(200);
    },
  );

  it('allows selecting the Codex provider without a bearer token', async () => {
    mocks.config.provider = 'openai';
    expect((await request('/api/facts/config', { provider: 'codex' })).status).toBe(200);
    expect(mocks.config.provider).toBe('codex');
  });

  it('rejects cross-origin changes without a bearer token', async () => {
    expect((await request('/api/facts/config', { prompt: 'Changed' }, { origin: 'https://foreign.example' })).status).toBe(403);
    expect(mocks.config.prompt).toBe('Useful music facts');
  });

  it('invalidates work for content changes while retaining reuse for display and ignored cap changes', async () => {
    expect((await request('/api/facts/config', { rotationInterval: 30, maxOutputTokens: 3000 })).status).toBe(200);
    expect(research.invalidate).not.toHaveBeenCalled();
    expect((await request('/api/facts/config', { prompt: 'Changed' })).status).toBe(200);
    expect(research.invalidate).toHaveBeenCalledOnce();
  });

  it('allows recovery to an API provider when the Codex runtime is explicitly unavailable', async () => {
    expect((await request('/disabled/facts/config', { provider: 'openai' }, { origin: 'https://foreign.example' })).status).toBe(403);
    expect(mocks.config.provider).toBe('codex');
    expect((await request('/disabled/facts/config', { provider: 'openai' })).status).toBe(200);
    expect(mocks.config.provider).toBe('openai');
    expect((await request('/disabled/facts/config', { provider: 'codex' })).status).toBe(503);
  });

  it('allows forced research tests without a bearer token and preserves sources and metrics', async () => {
    const response = await request('/api/facts/test', metadata);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ...sourcedResult, durationMs: expect.any(Number) });
    expect(research.generate).toHaveBeenCalledWith(metadata, expect.objectContaining({ provider: 'codex' }), { force: true });
  });

  it('relays only typed, safe research errors', async () => {
    research.generate.mockRejectedValueOnce(new CodexResearchError('not-connected'));
    const disconnected = await request('/api/facts', metadata);
    expect(disconnected.status).toBe(503);
    expect((await disconnected.json()).error.message).toContain('Connect a ChatGPT account');
    research.generate.mockRejectedValueOnce(new Error('private token and raw provider error'));
    expect(await (await request('/api/facts', metadata)).text()).not.toContain('private token');
  });
});
