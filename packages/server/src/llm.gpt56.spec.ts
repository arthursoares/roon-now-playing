import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FactsConfig } from '@roon-screen-cover/shared';
import {
  AnthropicProvider,
  OpenAIProvider,
  buildOpenAIFactsRequest,
  parseOpenAIFactsCompletion,
} from './llm.js';
import { OutputLimitError } from './llmErrors.js';

const mocks = vi.hoisted(() => ({
  anthropicConstructor: vi.fn(),
  anthropicCreate: vi.fn(),
  openAIConstructor: vi.fn(),
  openAICreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mocks.anthropicCreate };

    constructor(options: unknown) {
      mocks.anthropicConstructor(options);
    }
  },
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mocks.openAICreate } };

    constructor(options: unknown) {
      mocks.openAIConstructor(options);
    }
  },
}));

const baseConfig: FactsConfig = {
  provider: 'openai',
  model: 'gpt-5.6-luna',
  apiKey: 'test-key',
  factsCount: 3,
  rotationInterval: 25,
  prompt: 'Return a JSON array about {artist}, {album}, and {title}. Count: {factsCount}.',
};

function completion(
  content: string | null,
  finishReason = 'stop',
  refusal: string | null = null,
) {
  return {
    choices: [{
      finish_reason: finishReason,
      message: { content, refusal, role: 'assistant' },
    }],
  } as Parameters<typeof parseOpenAIFactsCompletion>[0];
}

describe('OpenAI GPT-5 facts requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.openAICreate.mockResolvedValue(completion('{"facts":["Fact one","Fact two"]}'));
  });

  it.each(['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6'])(
    'uses no reasoning and strict structured output for %s',
    (model) => {
      const request = buildOpenAIFactsRequest({ ...baseConfig, model }, 'Artist', 'Album', 'Title');

      expect(request).toMatchObject({
        model,
        reasoning_effort: 'none',
        max_completion_tokens: 2048,
        response_format: {
          type: 'json_schema',
          json_schema: {
            strict: true,
            schema: {
              type: 'object',
              properties: { facts: { type: 'array', items: { type: 'string' } } },
              required: ['facts'],
              additionalProperties: false,
            },
          },
        },
      });
    },
  );

  it.each([
    { model: 'gpt-5.5', reasoningEffort: 'none', maxOutputTokens: 2048 },
    { model: 'gpt-6-astra', reasoningEffort: 'low', maxOutputTokens: 8192 },
  ])('builds a compatible structured payload for $model', ({
    model,
    reasoningEffort,
    maxOutputTokens,
  }) => {
    const request = buildOpenAIFactsRequest({ ...baseConfig, model }, 'Artist', 'Album', 'Title');

    expect(request).toMatchObject({
      model,
      reasoning_effort: reasoningEffort,
      max_completion_tokens: maxOutputTokens,
      messages: [
        { role: 'developer', content: expect.stringContaining('facts') },
        { role: 'user', content: expect.stringContaining('Artist') },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { strict: true },
      },
    });
    expect(request).not.toHaveProperty('temperature');
    expect(request).not.toHaveProperty('top_p');
    expect(request).not.toHaveProperty('logprobs');
  });

  it.each(['gpt-5.5', 'gpt-6-astra'])(
    'parses structured facts and rejects refusals for %s',
    (model) => {
      const config = { ...baseConfig, model };
      expect(parseOpenAIFactsCompletion(
        completion('{"facts":["Fact one","Fact two"]}'),
        config,
      )).toEqual(['Fact one', 'Fact two']);
      expect(parseOpenAIFactsCompletion(
        completion(null, 'stop', 'Cannot comply'),
        config,
      )).toEqual([]);
    },
  );

  it.each(['gpt-5.5', 'gpt-6-astra'])(
    'rejects length-limited %s completions without returning partial facts',
    (model) => {
      const config = { ...baseConfig, model };
      expect(() => parseOpenAIFactsCompletion(
        completion('{"facts":["Partial"]}', 'length'),
        config,
      )).toThrowError(OutputLimitError);
    },
  );

  it.each([
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'gpt-5-2025-08-07',
    'gpt-5-mini-2025-08-07',
    'gpt-5-nano-2025-08-07',
  ])('uses minimal reasoning and the original GPT-5 budget for %s', (model) => {
    const request = buildOpenAIFactsRequest({ ...baseConfig, model }, 'Artist', 'Album', 'Title');

    expect(request.reasoning_effort).toBe('minimal');
    expect(request.reasoning_effort).not.toBe('none');
    expect(request.max_completion_tokens).toBe(8192);
    expect(request.response_format).toMatchObject({ type: 'json_schema' });
  });

  it('never sends none reasoning to original GPT-5 when loaded from a saved default', () => {
    const request = buildOpenAIFactsRequest(
      { ...baseConfig, model: 'gpt-5-mini', openaiReasoningEffort: 'none' },
      'Artist',
      'Album',
      'Title',
    );

    expect(request.reasoning_effort).toBe('minimal');
  });

  it.each(['low', 'high'] as const)('honors a supported configured %s reasoning effort', (effort) => {
    const request = buildOpenAIFactsRequest(
      { ...baseConfig, openaiReasoningEffort: effort },
      'Artist',
      'Album',
      'Title',
    );

    expect(request.reasoning_effort).toBe(effort);
  });

  it('omits reasoning and structured-output parameters for unsupported models', () => {
    const request = buildOpenAIFactsRequest(
      { ...baseConfig, model: 'gpt-4o', openaiReasoningEffort: 'high' },
      'Artist',
      'Album',
      'Title',
    );

    expect(request).not.toHaveProperty('reasoning_effort');
    expect(request).not.toHaveProperty('response_format');
    expect(request.max_completion_tokens).toBe(1024);
  });

  it('preserves an explicitly configured output-token cap', () => {
    const request = buildOpenAIFactsRequest(
      { ...baseConfig, model: 'gpt-5-mini', maxOutputTokens: 4096 },
      'Artist',
      'Album',
      'Title',
    );

    expect(request.max_completion_tokens).toBe(4096);
  });

  it('puts the schema-format override before a preserved custom prompt', () => {
    const prompt = 'Return JSON array only. Artist={artist}; Album={album}; Title={title}.';
    const request = buildOpenAIFactsRequest(
      { ...baseConfig, prompt },
      'A $& {title}',
      'B {artist}',
      'C $` braces {album}',
    );

    expect(request.messages[0]).toMatchObject({ role: 'developer' });
    expect(String(request.messages[0].content)).toContain('facts');
    expect(request.messages[1]).toEqual({
      role: 'user',
      content: 'Return JSON array only. Artist=A $& {title}; Album=B {artist}; Title=C $` braces {album}.',
    });
  });

  it('unwraps strict structured output to the public string-array contract', () => {
    expect(parseOpenAIFactsCompletion(
      completion('{"facts":["Fact one","Fact two"]}'),
      baseConfig,
    )).toEqual(['Fact one', 'Fact two']);
  });

  it.each([
    ['refusal', completion(null, 'stop', 'Cannot comply')],
    ['content filter', completion(null, 'content_filter')],
    ['other incomplete finish', completion('{"facts":["Partial"]}', 'tool_calls')],
    ['malformed JSON', completion('{"facts":[')],
    ['wrong schema', completion('["Legacy array"]')],
    ['empty schema result', completion('{"facts":[]}')],
    ['non-string fact', completion('{"facts":[42]}')],
  ])('safely rejects %s results', (_scenario, response) => {
    expect(parseOpenAIFactsCompletion(response, baseConfig)).toEqual([]);
  });

  it.each([
    {
      scenario: 'Luna with none reasoning',
      config: { ...baseConfig, maxOutputTokens: 2048 },
      expected: ['2048-token', 'Generate fewer or shorter facts'],
      excluded: ['reasoning tokens', 'Lower Reasoning effort'],
    },
    {
      scenario: 'original GPT-5 with minimal reasoning',
      config: { ...baseConfig, model: 'gpt-5-mini', maxOutputTokens: 4096 },
      expected: ['4096-token', 'reasoning tokens', 'Generate fewer or shorter facts'],
      excluded: ['Lower Reasoning effort'],
    },
    {
      scenario: 'GPT-5 with reducible high reasoning',
      config: {
        ...baseConfig,
        model: 'gpt-5-mini',
        maxOutputTokens: 4096,
        openaiReasoningEffort: 'high' as const,
      },
      expected: ['4096-token', 'reasoning tokens', 'Lower Reasoning effort'],
      excluded: ['Generate fewer or shorter facts'],
    },
  ])('reports accurate length remediation for $scenario', ({ config, expected, excluded }) => {
    expect(() => parseOpenAIFactsCompletion(completion(null, 'length'), config))
      .toThrowError(OutputLimitError);

    try {
      parseOpenAIFactsCompletion(completion(null, 'length'), config);
    } catch (error) {
      for (const text of expected) expect((error as Error).message).toContain(text);
      for (const text of excluded) expect((error as Error).message).not.toContain(text);
    }
  });

  it('uses bounded SDK clients with automatic retries disabled', () => {
    new OpenAIProvider(baseConfig);
    new AnthropicProvider({ ...baseConfig, provider: 'anthropic' });

    expect(mocks.openAIConstructor).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'test-key', timeout: 120_000, maxRetries: 0,
    }));
    expect(mocks.anthropicConstructor).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'test-key', timeout: 120_000, maxRetries: 0,
    }));
  });

  it('uses the production request builder and parser in OpenAIProvider', async () => {
    const provider = new OpenAIProvider(baseConfig);

    await expect(provider.generateFacts('Artist', 'Album', 'Title')).resolves.toEqual([
      'Fact one', 'Fact two',
    ]);
    expect(mocks.openAICreate).toHaveBeenCalledWith(buildOpenAIFactsRequest(
      baseConfig,
      'Artist',
      'Album',
      'Title',
    ));
  });
});
