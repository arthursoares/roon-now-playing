/**
 * Test Plan: LLM Providers
 *
 * Scenario: Factory creates correct provider based on config
 *   Given a FactsConfig with a provider setting
 *   When createLLMProvider is called
 *   Then it should return the appropriate provider instance
 *
 * Scenario: AnthropicProvider generates facts
 *   Given an AnthropicProvider with valid config
 *   When generateFacts is called with artist, album, and title
 *   Then it should return an array of facts from the Anthropic API
 *
 * Scenario: OpenAIProvider generates facts
 *   Given an OpenAIProvider with valid config
 *   When generateFacts is called with artist, album, and title
 *   Then it should return an array of facts from the OpenAI API
 *
 * Scenario: Parse LLM response extracts JSON array
 *   Given a response containing a JSON array
 *   When the response is parsed
 *   Then it should extract the facts array
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMProvider, AnthropicProvider, OpenAIProvider, OpenRouterProvider, LocalLLMProvider } from './llm.js';
import { OutputLimitError } from './llmErrors.js';
import { logger } from './logger.js';
import type { FactsConfig } from '@roon-screen-cover/shared';

const { mockAnthropicCreate, mockOpenAICreate } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
  mockOpenAICreate: vi.fn(),
}));

// Add mock for global fetch at the top level
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const logSpies = [
  vi.spyOn(logger, 'debug').mockImplementation(() => undefined),
  vi.spyOn(logger, 'info').mockImplementation(() => undefined),
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined),
  vi.spyOn(logger, 'error').mockImplementation(() => undefined),
];

function loggedText(): string {
  return logSpies.flatMap((spy) => spy.mock.calls.flat()).join(' ');
}

// Mock the SDKs with class constructors
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockAnthropicCreate,
      };
    },
  };
});

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockOpenAICreate,
        },
      };
    },
  };
});

describe('LLM Providers', () => {
  const baseConfig: FactsConfig = {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    apiKey: 'test-key',
    factsCount: 5,
    rotationInterval: 25,
    prompt: 'Generate {factsCount} facts about {artist} - {title} from {album}',
  };

  beforeEach(() => {
    logSpies.forEach((spy) => spy.mockClear());
    mockAnthropicCreate.mockReset().mockResolvedValue({
      content: [{ type: 'text', text: '["Fact 1", "Fact 2", "Fact 3"]' }],
      stop_reason: 'end_turn',
    });
    mockOpenAICreate.mockReset().mockResolvedValue({
      choices: [{ message: { content: '["Fact 1", "Fact 2"]' }, finish_reason: 'stop' }],
    });
  });

  describe('createLLMProvider', () => {
    it('should create AnthropicProvider for anthropic', () => {
      const provider = createLLMProvider({ ...baseConfig, provider: 'anthropic' });
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should create OpenAIProvider for openai', () => {
      const provider = createLLMProvider({ ...baseConfig, provider: 'openai' });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('AnthropicProvider', () => {
    it('should generate facts', async () => {
      const provider = new AnthropicProvider(baseConfig);
      const facts = await provider.generateFacts('Artist', 'Album', 'Title');
      expect(Array.isArray(facts)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);
    });

    it.each([
      { maxOutputTokens: undefined, expected: 1024 },
      { maxOutputTokens: 4096, expected: 4096 },
    ])('should request $expected maximum output tokens', async ({ maxOutputTokens, expected }) => {
      const provider = new AnthropicProvider({ ...baseConfig, maxOutputTokens });
      await provider.generateFacts('Artist', 'Album', 'Title');

      expect(mockAnthropicCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: expected }));
    });

    it('should reject a response truncated at the configured output limit', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: '["Incomplete fact"' }],
        stop_reason: 'max_tokens',
      });
      const provider = new AnthropicProvider({ ...baseConfig, maxOutputTokens: 2048 });

      await expect(provider.generateFacts('Artist', 'Album', 'Title')).rejects.toBeInstanceOf(OutputLimitError);
    });

    it('should not log raw Anthropic SDK errors', async () => {
      const secret = 'anthropic-raw-secret';
      mockAnthropicCreate.mockRejectedValueOnce(Object.assign(new Error(secret), { status: 401 }));
      const provider = new AnthropicProvider(baseConfig);

      await expect(provider.generateFacts('Artist', 'Album', 'Title')).rejects.toThrow(secret);
      expect(loggedText()).toContain('Anthropic API request failed with HTTP status 401');
      expect(loggedText()).not.toContain(secret);
    });
  });

  describe('OpenAIProvider', () => {
    it('should generate facts', async () => {
      const config = { ...baseConfig, provider: 'openai' as const, model: 'gpt-4o' };
      const provider = new OpenAIProvider(config);
      const facts = await provider.generateFacts('Artist', 'Album', 'Title');
      expect(Array.isArray(facts)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);
    });

    it.each([
      { maxOutputTokens: undefined, expected: 1024 },
      { maxOutputTokens: 4096, expected: 4096 },
    ])('should request $expected maximum output tokens', async ({ maxOutputTokens, expected }) => {
      const provider = new OpenAIProvider({
        ...baseConfig,
        provider: 'openai',
        model: 'gpt-5-mini',
        maxOutputTokens,
      });
      await provider.generateFacts('Artist', 'Album', 'Title');

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_completion_tokens: expected }),
      );
    });

    it('should reject a response truncated at the configured output limit', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: '["Incomplete fact"' }, finish_reason: 'length' }],
      });
      const provider = new OpenAIProvider({ ...baseConfig, provider: 'openai', maxOutputTokens: 2048 });

      await expect(provider.generateFacts('Artist', 'Album', 'Title')).rejects.toBeInstanceOf(OutputLimitError);
    });

    it('should not log raw OpenAI SDK errors', async () => {
      const secret = 'openai-raw-secret';
      mockOpenAICreate.mockRejectedValueOnce(Object.assign(new Error(secret), { status: 429 }));
      const provider = new OpenAIProvider({ ...baseConfig, provider: 'openai' });

      await expect(provider.generateFacts('Artist', 'Album', 'Title')).rejects.toThrow(secret);
      expect(loggedText()).toContain('OpenAI API request failed with HTTP status 429');
      expect(loggedText()).not.toContain(secret);
    });

    it('should log only response length when parsing fails', async () => {
      const secret = 'unparseable-openai-secret';
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: secret }, finish_reason: 'stop' }],
      });
      const provider = new OpenAIProvider({ ...baseConfig, provider: 'openai' });

      await expect(provider.generateFacts('Artist', 'Album', 'Title')).resolves.toEqual([]);
      expect(loggedText()).toContain(`${secret.length} response characters`);
      expect(loggedText()).not.toContain(secret);
    });
  });

  describe('OpenRouterProvider', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should be created by factory for openrouter provider', () => {
      const config = { ...baseConfig, provider: 'openrouter' as const };
      const provider = createLLMProvider(config);
      expect(provider).toBeInstanceOf(OpenRouterProvider);
    });

    it('should generate facts via OpenRouter API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '["Fact from OpenRouter"]' } }],
        }),
      });

      const config = {
        ...baseConfig,
        provider: 'openrouter' as const,
        model: 'meta-llama/llama-3.1-70b-instruct',
      };
      const provider = new OpenRouterProvider(config);
      const facts = await provider.generateFacts('Artist', 'Album', 'Title');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${config.apiKey}`,
            'HTTP-Referer': expect.any(String),
            'X-Title': 'Roon Now Playing',
          }),
        })
      );
      expect(facts).toEqual(['Fact from OpenRouter']);
    });

    it.each([
      { maxOutputTokens: undefined, expected: 1024 },
      { maxOutputTokens: 4096, expected: 4096 },
    ])('should request $expected maximum output tokens', async ({ maxOutputTokens, expected }) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '["Fact"]' }, finish_reason: 'stop' }],
        }),
      });
      const provider = new OpenRouterProvider({ ...baseConfig, provider: 'openrouter', maxOutputTokens });

      await provider.generateFacts('Artist', 'Album', 'Title');

      const request = mockFetch.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(request.body as string)).toEqual(expect.objectContaining({ max_tokens: expected }));
    });

    it('should reject a response truncated at the configured output limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '["Incomplete fact"' }, finish_reason: 'length' }],
        }),
      });
      const provider = new OpenRouterProvider({ ...baseConfig, provider: 'openrouter', maxOutputTokens: 2048 });

      await expect(provider.generateFacts('Artist', 'Album', 'Title')).rejects.toBeInstanceOf(OutputLimitError);
    });

    it('should not log raw OpenRouter error responses', async () => {
      const secret = 'openrouter-raw-secret';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue(secret),
      });
      const provider = new OpenRouterProvider({ ...baseConfig, provider: 'openrouter' });

      await expect(provider.generateFacts('Artist', 'Album', 'Title')).rejects.toThrow('Provider request failed');
      expect(loggedText()).toContain('OpenRouter API request failed with HTTP status 429');
      expect(loggedText()).not.toContain(secret);
    });
  });

  describe('LocalLLMProvider', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should be created by factory for local provider', () => {
      const config = { ...baseConfig, provider: 'local' as const, localBaseUrl: 'http://localhost:11434/v1' };
      const provider = createLLMProvider(config);
      expect(provider).toBeInstanceOf(LocalLLMProvider);
    });

    it('should generate facts via Local LLM API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '["Local fact"]' } }],
        }),
      });

      const config = {
        ...baseConfig,
        provider: 'local' as const,
        model: 'llama3.1',
        localBaseUrl: 'http://localhost:11434/v1',
        apiKey: '',
      };
      const provider = new LocalLLMProvider(config);
      const facts = await provider.generateFacts('Artist', 'Album', 'Title');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(facts).toEqual(['Local fact']);
    });

    it.each([
      { maxOutputTokens: undefined, expected: 1024 },
      { maxOutputTokens: 4096, expected: 4096 },
    ])('should request $expected maximum output tokens', async ({ maxOutputTokens, expected }) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '["Fact"]' }, finish_reason: 'stop' }],
        }),
      });
      const provider = new LocalLLMProvider({
        ...baseConfig,
        provider: 'local',
        localBaseUrl: 'http://localhost:11434/v1',
        maxOutputTokens,
      });

      await provider.generateFacts('Artist', 'Album', 'Title');

      const request = mockFetch.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(request.body as string)).toEqual(expect.objectContaining({ max_tokens: expected }));
    });

    it('should reject a response truncated at the configured output limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '["Incomplete fact"' }, finish_reason: 'length' }],
        }),
      });
      const provider = new LocalLLMProvider({
        ...baseConfig,
        provider: 'local',
        localBaseUrl: 'http://localhost:11434/v1',
        maxOutputTokens: 2048,
      });

      await expect(provider.generateFacts('Artist', 'Album', 'Title')).rejects.toBeInstanceOf(OutputLimitError);
    });

    it('should not log raw Local LLM error responses', async () => {
      const secret = 'local-raw-secret';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue(secret),
      });
      const provider = new LocalLLMProvider({
        ...baseConfig,
        provider: 'local',
        localBaseUrl: 'http://localhost:11434/v1',
      });

      await expect(provider.generateFacts('Artist', 'Album', 'Title')).rejects.toThrow('Provider request failed');
      expect(loggedText()).toContain('Local LLM API request failed with HTTP status 500');
      expect(loggedText()).not.toContain(secret);
    });

    it('should work without API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '["Fact"]' } }],
        }),
      });

      const config = {
        ...baseConfig,
        provider: 'local' as const,
        model: 'llama3.1',
        localBaseUrl: 'http://localhost:11434/v1',
        apiKey: '',
      };
      const provider = new LocalLLMProvider(config);
      await provider.generateFacts('Artist', 'Album', 'Title');

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should include Authorization header when API key provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '["Fact"]' } }],
        }),
      });

      const config = {
        ...baseConfig,
        provider: 'local' as const,
        model: 'llama3.1',
        localBaseUrl: 'http://localhost:11434/v1',
        apiKey: 'local-secret',
      };
      const provider = new LocalLLMProvider(config);
      await provider.generateFacts('Artist', 'Album', 'Title');

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer local-secret');
    });

    it('should use custom base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '["Fact"]' } }],
        }),
      });

      const config = {
        ...baseConfig,
        provider: 'local' as const,
        model: 'mistral',
        localBaseUrl: 'http://localhost:1234/v1',
        apiKey: '',
      };
      const provider = new LocalLLMProvider(config);
      await provider.generateFacts('Artist', 'Album', 'Title');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.anything()
      );
    });
  });
});
