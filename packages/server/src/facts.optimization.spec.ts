import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FactsConfig } from '@roon-screen-cover/shared';

const mocks = vi.hoisted(() => {
  const entries = new Map<string, { facts: string[]; timestamp: number }>();
  return {
    config: {
      provider: 'openai',
      model: 'gpt-5.6-luna',
      apiKey: 'test-key',
      factsCount: 5,
      rotationInterval: 25,
      prompt: 'Prompt one',
      maxOutputTokens: 1024,
      openaiReasoningEffort: 'none',
      localBaseUrl: 'http://localhost:11434/v1',
    } as FactsConfig,
    entries,
    generate: vi.fn(),
    cacheSet: vi.fn(),
  };
});

function generationKey(config: FactsConfig, artist: string, album: string, title: string): string {
  return JSON.stringify([
    artist.trim().toLowerCase(), album.trim().toLowerCase(), title.trim().toLowerCase(),
    config.provider, config.model, config.prompt, config.factsCount, config.maxOutputTokens,
    config.openaiReasoningEffort, config.localBaseUrl,
  ]);
}

vi.mock('./factsConfig.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./factsConfig.js')>();
  return {
    ...actual,
    FactsConfigStore: class {
      get() { return { ...mocks.config }; }
      update(updates: Partial<FactsConfig>) { Object.assign(mocks.config, updates); }
    },
  };
});

vi.mock('./factsCache.js', () => ({
  FactsCache: class {
    makeKey(artist: string, album: string, title: string, config: FactsConfig) {
      return generationKey(config, artist, album, title);
    }
    getEntry(artist: string, album: string, title: string, config: FactsConfig) {
      return mocks.entries.get(generationKey(config, artist, album, title)) ?? null;
    }
    set(artist: string, album: string, title: string, facts: string[], config: FactsConfig, timestamp: number) {
      const entry = { facts, timestamp };
      mocks.entries.set(generationKey(config, artist, album, title), entry);
      mocks.cacheSet(artist, album, title, facts, config, timestamp);
    }
  },
}));

vi.mock('./llm.js', () => ({
  createLLMProvider: (config: FactsConfig) => ({
    generateFacts: (artist: string, album: string, title: string) => mocks.generate(config, artist, album, title),
  }),
}));

import { createFactsRouter } from './facts.js';

describe('facts request optimization', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    mocks.entries.clear();
    mocks.generate.mockReset();
    mocks.cacheSet.mockReset();
    Object.assign(mocks.config, {
      provider: 'openai', model: 'gpt-5.6-luna', apiKey: 'test-key', factsCount: 5,
      rotationInterval: 25, prompt: 'Prompt one', maxOutputTokens: 1024,
      openaiReasoningEffort: 'none', localBaseUrl: 'http://localhost:11434/v1',
    });

    const app = express();
    app.use(express.json());
    app.use('/api', createFactsRouter());
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function request(body: unknown = { artist: ' Artist ', album: ' Album ', title: ' Title' }, endpoint = '/facts') {
    return fetch(`${baseUrl}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  }

  it('coalesces concurrent identical cache misses and stores their result once', async () => {
    let resolveGeneration!: (facts: string[]) => void;
    mocks.generate.mockReturnValue(new Promise<string[]>((resolve) => { resolveGeneration = resolve; }));

    const first = request();
    const second = request({ artist: 'artist', album: 'album', title: 'title' });
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    resolveGeneration(['Shared fact']);

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect((await firstResponse.json()).facts).toEqual(['Shared fact']);
    expect((await secondResponse.json()).facts).toEqual(['Shared fact']);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.cacheSet).toHaveBeenCalledTimes(1);
  });

  it('clears a failed in-flight generation so the next request retries', async () => {
    mocks.generate.mockRejectedValueOnce(new Error('failure')).mockResolvedValueOnce(['Retry fact']);
    expect((await request()).status).toBe(500);
    expect((await request()).status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it('keeps an old in-flight result in its original configuration namespace', async () => {
    let resolveFirst!: (facts: string[]) => void;
    mocks.generate.mockImplementationOnce(() => new Promise<string[]>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(['New config fact']);

    const oldRequest = request();
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    mocks.config.prompt = 'Prompt two';
    const newResponse = await request();
    resolveFirst(['Old config fact']);
    const oldResponse = await oldRequest;

    expect((await newResponse.json()).facts).toEqual(['New config fact']);
    expect((await oldResponse.json()).facts).toEqual(['Old config fact']);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.cacheSet).toHaveBeenCalledTimes(2);
    expect(mocks.entries.get(generationKey(mocks.config, 'artist', 'album', 'title'))?.facts)
      .toEqual(['New config fact']);
  });

  it('does not join in-flight work created with a rotated API key', async () => {
    let rejectOld!: (error: Error) => void;
    mocks.generate
      .mockImplementationOnce(() => new Promise<string[]>((_resolve, reject) => { rejectOld = reject; }))
      .mockResolvedValueOnce(['New key fact']);

    const oldRequest = request();
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    const updateResponse = await fetch(`${baseUrl}/facts/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'new-key' }),
    });
    expect(updateResponse.status).toBe(200);

    const newRequest = request();
    try {
      await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(2), { timeout: 200 });
    } finally {
      rejectOld(new Error('old key rejected'));
    }
    const [oldResponse, newResponse] = await Promise.all([oldRequest, newRequest]);

    expect(oldResponse.status).toBe(500);
    expect(newResponse.status).toBe(200);
    expect((await newResponse.json()).facts).toEqual(['New key fact']);
    expect(mocks.generate.mock.calls[0]?.[0]).toMatchObject({ apiKey: 'test-key' });
    expect(mocks.generate.mock.calls[1]?.[0]).toMatchObject({ apiKey: 'new-key' });
  });

  it('serves a configuration-matching cache hit before requiring a cloud API key', async () => {
    mocks.config.apiKey = '';
    const timestamp = Date.now() - 10;
    mocks.entries.set(generationKey(mocks.config, 'artist', 'album', 'title'), {
      facts: ['Cached fact'], timestamp,
    });

    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ facts: ['Cached fact'], cached: true, generatedAt: timestamp });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each([
    ['/facts', { artist: '', album: 'Album', title: 'Title' }],
    ['/facts', { artist: '   ', album: 'Album', title: 'Title' }],
    ['/facts', { artist: 42, album: 'Album', title: 'Title' }],
    ['/facts', { artist: 'a'.repeat(501), album: 'Album', title: 'Title' }],
    ['/facts/test', { artist: 'Artist', album: null, title: 'Title' }],
  ])('rejects invalid metadata before any paid generation at %s', async (endpoint, body) => {
    const response = await request(body, endpoint);
    expect(response.status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('keeps the test endpoint outside the result cache', async () => {
    mocks.generate.mockResolvedValue(['Fresh test fact']);
    mocks.entries.set(generationKey(mocks.config, 'artist', 'album', 'title'), {
      facts: ['Cached fact'], timestamp: Date.now(),
    });
    const response = await fetch(`${baseUrl}/facts/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist: 'Artist', album: 'Album', title: 'Title' }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).facts).toEqual(['Fresh test fact']);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
});
