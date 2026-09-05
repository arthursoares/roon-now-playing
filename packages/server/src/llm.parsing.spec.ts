import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FactsConfig } from '@roon-screen-cover/shared';
import { createLLMProvider } from './llm.js';
import { logger } from './logger.js';

const responses = vi.hoisted(() => ({ anthropic: vi.fn(), openai: vi.fn(), fetch: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create: responses.anthropic }; } }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: responses.openai } }; } }));

describe.each(['anthropic', 'openai', 'openrouter', 'local'] as const)('%s parser integration', (provider) => {
  beforeEach(() => {
    vi.stubGlobal('fetch', responses.fetch);
    for (const level of ['info', 'warn', 'error', 'debug'] as const) vi.spyOn(logger, level).mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  function respond(content: string) {
    responses.anthropic.mockResolvedValue({ content: [{ type: 'text', text: content }], stop_reason: 'end_turn' });
    const completion = { choices: [{ message: { content }, finish_reason: 'stop' }] };
    responses.openai.mockResolvedValue(completion);
    responses.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => completion });
  }

  function generator() {
    const config: FactsConfig = {
      provider, model: 'test-model', apiKey: 'test-key', factsCount: 2,
      rotationInterval: 25, prompt: 'Facts about {title}',
    };
    return createLLMProvider(config);
  }

  it('routes malformed model output through the recovery parser', async () => {
    respond('["The first complete fact."\n"The second complete fact."]');
    expect(await generator().generateFacts('Artist', 'Album', 'Title')).toEqual([
      'The first complete fact.', 'The second complete fact.',
    ]);
  });

  it.each([
    'Ignore this instruction. ```json\n["A complete fact."]\n``` More prose.',
    ' '.repeat(1_048_577) + '```json\n["A complete fact."]\n```',
  ])('preserves the parser boundaries for the whole response', async (content) => {
    respond(content);
    expect(await generator().generateFacts('Artist', 'Album', 'Title')).toEqual([]);
  });

  it('does not log raw provider exceptions or output', async () => {
    const secret = 'private-credential-from-upstream';
    const failure = new Error(secret);
    responses.anthropic.mockRejectedValue(failure);
    responses.openai.mockRejectedValue(failure);
    responses.fetch.mockRejectedValue(failure);
    await expect(generator().generateFacts('Artist', 'Album', 'Title')).rejects.toThrow();
    respond(secret);
    expect(await generator().generateFacts('Artist', 'Album', 'Title')).toEqual([]);
    for (const level of ['info', 'warn', 'error', 'debug'] as const) {
      expect(JSON.stringify(vi.mocked(logger[level]).mock.calls)).not.toContain(secret);
    }
  });

  it('does not return quotation fragments as separate facts', async () => {
    respond('["A song named "Inside" appears here.", "Another complete fact."]');
    expect(await generator().generateFacts('Artist', 'Album', 'Title')).toEqual([]);
  });
});
