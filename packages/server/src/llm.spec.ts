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

import { describe, it, expect, vi } from 'vitest';
import { createLLMProvider, AnthropicProvider, OpenAIProvider } from './llm.js';
import type { FactsConfig } from '@roon-screen-cover/shared';

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
});
