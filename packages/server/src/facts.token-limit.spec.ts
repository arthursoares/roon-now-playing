import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { OutputLimitError } from './llmErrors.js';
import { logger } from './logger.js';

const { mockCreateLLMProvider, mockConfigUpdate } = vi.hoisted(() => ({
  mockCreateLLMProvider: vi.fn(),
  mockConfigUpdate: vi.fn(),
}));

vi.mock('./llm.js', () => ({ createLLMProvider: mockCreateLLMProvider }));

vi.mock('./factsConfig.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./factsConfig.js')>();
  return {
    ...actual,
    FactsConfigStore: class {
      get() {
        return {
          ...actual.DEFAULT_CONFIG,
          apiKey: 'configured-test-key',
        };
      }

      update(updates: unknown) {
        mockConfigUpdate(updates);
      }
    },
  };
});

import { createFactsRouter } from './facts.js';

const logSpies = [
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined),
  vi.spyOn(logger, 'error').mockImplementation(() => undefined),
];

function loggedText(): string {
  return logSpies.flatMap((spy) => spy.mock.calls.flat()).join(' ');
}

describe('facts token limit API', () => {
  let server: Server | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', createFactsRouter());
    const testServer = app.listen(0, '127.0.0.1');
    server = testServer;
    await new Promise<void>((resolve) => testServer.once('listening', resolve));
    const address = testServer.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP test server');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (!server?.listening) return;
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => error ? reject(error) : resolve());
    });
  });

  beforeEach(() => {
    mockCreateLLMProvider.mockReset();
    mockConfigUpdate.mockReset();
    logSpies.forEach((spy) => spy.mockClear());
  });

  it.each(['/api/facts', '/api/facts/test'])(
    'returns a safe actionable 502 for truncated output from %s',
    async (path) => {
      mockCreateLLMProvider.mockReturnValue({
        generateFacts: vi.fn().mockRejectedValue(new OutputLimitError(2048)),
      });

      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: 'Artist', album: 'Album', title: 'Title' }),
      });

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        error: {
          type: 'api-error',
          message: 'The model response reached the 2048-token output limit. Increase Maximum output tokens in Advanced Settings and try again.',
        },
      });
      expect(loggedText()).toContain('configured output limit');
    },
  );

  it.each(['/api/facts', '/api/facts/test'])(
    'does not expose raw upstream errors from %s',
    async (path) => {
      mockCreateLLMProvider.mockReturnValue({
        generateFacts: vi.fn().mockRejectedValue(new Error('upstream secret response')),
      });

      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: 'Artist', album: 'Album', title: 'Title' }),
      });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: {
          type: 'api-error',
          message: 'Failed to generate facts. Please try again.',
        },
      });
      expect(loggedText()).not.toContain('upstream secret response');
    },
  );

  it.each([0, 65537, 1.5, '4096'])(
    'rejects invalid maxOutputTokens without updating config: %s',
    async (maxOutputTokens) => {
      const response = await fetch(`${baseUrl}/api/facts/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxOutputTokens }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'maxOutputTokens must be an integer between 1 and 65536',
      });
      expect(mockConfigUpdate).not.toHaveBeenCalled();
    },
  );
});
