import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createFactsRouter } from './facts.js';
import { logger } from './logger.js';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(), cacheGet: vi.fn(), cacheSet: vi.fn(),
  config: { provider: 'local', apiKey: '', model: 'test-model', prompt: '', factsCount: 5, rotationInterval: 25 },
}));
vi.mock('./factsConfig.js', () => ({ FactsConfigStore: class { get() { return mocks.config; } } }));
vi.mock('./factsCache.js', () => ({ FactsCache: class { get = mocks.cacheGet; set = mocks.cacheSet; } }));
vi.mock('./llm.js', () => ({ createLLMProvider: () => ({ generateFacts: mocks.generate }) }));

describe('facts API failure contract', () => {
  let server: Server;
  let base: string;
  beforeEach(async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    mocks.generate.mockReset().mockResolvedValue(['A complete fact.']);
    mocks.cacheGet.mockReset().mockReturnValue(null);
    mocks.cacheSet.mockReset();
    mocks.config.provider = 'local';
    mocks.config.apiKey = '';
    const app = express();
    app.use(express.json());
    app.use('/api', createFactsRouter());
    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });
  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    vi.restoreAllMocks();
  });

  function request(endpoint: string) {
    return fetch(`${base}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist: 'Artist', album: 'Album', title: 'Title' }) });
  }

  it('allows an unkeyed local model on the display endpoint as well as the test endpoint', async () => {
    const response = await request('/facts');
    expect(response.status).toBe(200);
    expect((await response.json()).facts).toEqual(['A complete fact.']);
    expect(mocks.cacheSet).toHaveBeenCalledTimes(1);
  });

  it.each(['/facts', '/facts/test'])('returns a typed non-success error for empty output from %s', async (endpoint) => {
    mocks.generate.mockResolvedValue([]);
    const response = await request(endpoint);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { type: 'empty', message: expect.any(String) } });
    expect(mocks.cacheSet).not.toHaveBeenCalled();
  });

  it.each(['/facts', '/facts/test'])('does not expose raw provider errors from %s', async (endpoint) => {
    mocks.generate.mockRejectedValue(new Error('upstream detail with private credentials'));
    const response = await request(endpoint);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ error: { type: 'api-error', message: expect.any(String) } });
    expect(JSON.stringify(body)).not.toContain('private credentials');
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('private credentials');
  });

  it('continues to require a key for cloud providers', async () => {
    mocks.config.provider = 'openrouter';
    const response = await request('/facts');
    expect(response.status).toBe(503);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
