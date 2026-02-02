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
import type { FactsConfig } from '@roon-screen-cover/shared';

// Add mock for global fetch at the top level
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock the SDKs with class constructors
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '["Fact 1", "Fact 2", "Fact 3"]' }],
        }),
      };
    },
  };
});

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '["Fact 1", "Fact 2"]' } }],
          }),
        },
      };
    },
  };
});

describe('LLM Providers', () => {
  const baseConfig: FactsConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: 'test-key',
    factsCount: 5,
    rotationInterval: 25,
    prompt: 'Generate {factsCount} facts about {artist} - {title} from {album}',
  };

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
  });

  describe('OpenAIProvider', () => {
    it('should generate facts', async () => {
      const config = { ...baseConfig, provider: 'openai' as const, model: 'gpt-4o' };
      const provider = new OpenAIProvider(config);
      const facts = await provider.generateFacts('Artist', 'Album', 'Title');
      expect(Array.isArray(facts)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);
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
