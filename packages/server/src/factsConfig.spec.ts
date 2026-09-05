/**
 * Test Plan: FactsConfigStore
 *
 * Scenario: Load default config when no file exists
 *   Given no config file exists at the specified path
 *   When a new FactsConfigStore is created
 *   Then it should return default configuration values
 *
 * Scenario: Persist config changes to file
 *   Given a FactsConfigStore instance
 *   When config is updated with partial values
 *   Then the changes should be persisted to disk
 *   And a new instance should load the persisted values
 *
 * Scenario: Merge partial updates
 *   Given a FactsConfigStore with existing config
 *   When multiple partial updates are applied
 *   Then all updates should be merged together
 *
 * Scenario: Environment variables take precedence for API keys
 *   Given a config file with an API key
 *   When an environment variable for the key is set
 *   Then the environment variable should take precedence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_FACTS_PROMPT } from '@roon-screen-cover/shared';
import { FactsConfigStore, DEFAULT_CONFIG, validateFactsConfigUpdate } from './factsConfig.js';
import { logger } from './logger.js';

const TEST_CONFIG_PATH = path.join(process.cwd(), 'test-facts-config.json');

describe('FactsConfigStore', () => {
  let store: FactsConfigStore;

  beforeEach(() => {
    // Clean up any existing test file
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    store = new FactsConfigStore(TEST_CONFIG_PATH);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it('should return default config when no file exists', () => {
    const config = store.get();
    expect(config.provider).toBe('anthropic');
    expect(config.factsCount).toBe(5);
    expect(config.rotationInterval).toBe(25);
    expect(config.maxOutputTokens).toBe(1024);
  });

  it('should save and load config', () => {
    store.update({ factsCount: 7, maxOutputTokens: 4096 });

    // Create new instance to verify persistence
    const store2 = new FactsConfigStore(TEST_CONFIG_PATH);
    const config = store2.get();
    expect(config.factsCount).toBe(7);
    expect(config.maxOutputTokens).toBe(4096);
  });

  it('should merge partial updates', () => {
    store.update({ factsCount: 10 });
    store.update({ provider: 'openai' });

    const config = store.get();
    expect(config.factsCount).toBe(10);
    expect(config.provider).toBe('openai');
  });

  it('should prefer environment variable for API key', () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-123';
    store.update({ apiKey: 'config-key' });

    const config = store.get();
    expect(config.apiKey).toBe('env-key-123');

    delete process.env.ANTHROPIC_API_KEY;
  });

  it('should use OpenAI env var when provider is openai', () => {
    store.update({ provider: 'openai' });
    process.env.OPENAI_API_KEY = 'openai-env-key';

    const config = store.get();
    expect(config.apiKey).toBe('openai-env-key');

    delete process.env.OPENAI_API_KEY;
  });

  it('should report whether API key is available', () => {
    expect(store.hasApiKey()).toBe(false);

    store.update({ apiKey: 'some-key' });
    expect(store.hasApiKey()).toBe(true);
  });

  it('should export DEFAULT_CONFIG with correct defaults', () => {
    expect(DEFAULT_CONFIG.provider).toBe('anthropic');
    expect(DEFAULT_CONFIG.model).toBe('claude-haiku-4-5');
    expect(DEFAULT_CONFIG.apiKey).toBe('');
    expect(DEFAULT_CONFIG.factsCount).toBe(5);
    expect(DEFAULT_CONFIG.rotationInterval).toBe(25);
    expect(DEFAULT_CONFIG.prompt).toBe(DEFAULT_FACTS_PROMPT);
    expect(DEFAULT_CONFIG.maxOutputTokens).toBe(1024);
    expect(DEFAULT_CONFIG.openaiReasoningEffort).toBe('none');
  });

  it.each([
    [{ factsCount: 0 }, 'factsCount'],
    [{ factsCount: 11 }, 'factsCount'],
    [{ factsCount: 1.5 }, 'factsCount'],
    [{ rotationInterval: 4 }, 'rotationInterval'],
    [{ rotationInterval: 61 }, 'rotationInterval'],
    [{ provider: 'unknown' }, 'provider'],
    [{ model: '   ' }, 'model'],
    [{ prompt: 7 }, 'prompt'],
    [{ openaiReasoningEffort: 'ultra' }, 'openaiReasoningEffort'],
    [{ localBaseUrl: '' }, 'localBaseUrl'],
  ])('rejects invalid recognized config %#', (update, field) => {
    const result = validateFactsConfigUpdate(update);
    expect(result).toEqual({ error: expect.stringContaining(field) });
  });

  it('rejects unknown persisted fields but ignores the read-only hasApiKey response field', () => {
    expect(validateFactsConfigUpdate({ surprise: true })).toEqual({
      error: expect.stringContaining('Unknown facts config field'),
    });
    expect(validateFactsConfigUpdate({ hasApiKey: true, factsCount: 6 })).toEqual({
      value: { factsCount: 6 },
    });
  });

  it.each([null, [], 'config'])('rejects non-object updates: %s', (update) => {
    expect(validateFactsConfigUpdate(update)).toEqual({ error: expect.any(String) });
  });

  it('normalizes invalid known values and drops unknown fields while loading', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      ...DEFAULT_CONFIG,
      provider: 'invalid',
      factsCount: 99,
      rotationInterval: 1,
      openaiReasoningEffort: 'ultra',
      unknown: 'do not persist',
    }));
    const loaded = new FactsConfigStore(TEST_CONFIG_PATH).get();
    expect(loaded.provider).toBe(DEFAULT_CONFIG.provider);
    expect(loaded.factsCount).toBe(DEFAULT_CONFIG.factsCount);
    expect(loaded.rotationInterval).toBe(DEFAULT_CONFIG.rotationInterval);
    expect(loaded.openaiReasoningEffort).toBe('none');
    expect(loaded).not.toHaveProperty('unknown');
  });

  it('preserves valid custom model and prompt values while loading', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      ...DEFAULT_CONFIG, provider: 'openrouter', model: 'vendor/custom-model', prompt: 'My custom prompt',
    }));
    const loaded = new FactsConfigStore(TEST_CONFIG_PATH).get();
    expect(loaded.model).toBe('vendor/custom-model');
    expect(loaded.prompt).toBe('My custom prompt');
  });

  it('migrates the exact v1.10 default prompt to the current shorter default', () => {
    const legacyDefaultPrompt = `Generate {factsCount} interesting, lesser-known facts about this music:

Artist: {artist}
Album: {album}
Track: {title}

Focus on:
- Recording history or interesting production details
- Historical context or cultural impact
- Connections to other artists or musical movements
- Awards, chart positions, or notable achievements
- Personal stories from the artist about this work

When possible, include attribution (e.g., "In a 1985 interview..." or "According to Songfacts...").

Keep each fact concise (2-3 sentences max). Prioritize surprising or educational information over common knowledge.

IMPORTANT: Return ONLY a valid JSON array of strings with no additional text, markdown, or explanation.

Example format:
["Fact one goes here.", "Fact two goes here.", "Fact three goes here."]`;
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ ...DEFAULT_CONFIG, prompt: legacyDefaultPrompt }));

    expect(new FactsConfigStore(TEST_CONFIG_PATH).get().prompt).toBe(DEFAULT_FACTS_PROMPT);
  });

  it.each([0, 65537, 1.5, Number.NaN])(
    'should reject invalid maxOutputTokens updates without changing or persisting state: %s',
    (maxOutputTokens) => {
      expect(() => store.update({ maxOutputTokens })).toThrow(RangeError);
      expect(store.get().maxOutputTokens).toBe(1024);
      expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(false);
    },
  );

  it.each([1, 65536])('should accept maxOutputTokens boundary value %s', (maxOutputTokens) => {
    store.update({ maxOutputTokens });

    expect(store.get().maxOutputTokens).toBe(maxOutputTokens);
  });

  it('should normalize invalid stored maxOutputTokens to the default', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      ...DEFAULT_CONFIG,
      maxOutputTokens: 70000,
    }));

    const store2 = new FactsConfigStore(TEST_CONFIG_PATH);

    expect(store2.get().maxOutputTokens).toBe(1024);
  });

  it('should add the default when loading legacy config without maxOutputTokens', () => {
    const legacyConfig = { ...DEFAULT_CONFIG };
    delete legacyConfig.maxOutputTokens;
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(legacyConfig));

    const store2 = new FactsConfigStore(TEST_CONFIG_PATH);

    expect(store2.get().maxOutputTokens).toBe(1024);
  });

  it.each([
    ['gpt-5.6-luna', 'gpt-5.6-luna', 2048, 'none'],
    ['gpt-5-mini', 'gpt-5.6-luna', 2048, 'none'],
    ['gpt-5-mini-2025-08-07', 'gpt-5-mini-2025-08-07', 8192, 'minimal'],
  ])('uses model-aware defaults for legacy OpenAI %s config', (model, expectedModel, tokens, effort) => {
    const legacyConfig = { ...DEFAULT_CONFIG, provider: 'openai', model };
    delete legacyConfig.maxOutputTokens;
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(legacyConfig));
    const loaded = new FactsConfigStore(TEST_CONFIG_PATH).get();
    expect(loaded.model).toBe(expectedModel);
    expect(loaded.maxOutputTokens).toBe(tokens);
    expect(loaded.openaiReasoningEffort).toBe(effort);
  });

  it('preserves an explicit valid output cap while resetting reasoning for a deprecated model', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      ...DEFAULT_CONFIG,
      provider: 'openai',
      model: 'gpt-5-mini',
      maxOutputTokens: 4096,
      openaiReasoningEffort: 'none',
    }));
    const loaded = new FactsConfigStore(TEST_CONFIG_PATH).get();
    expect(loaded.model).toBe('gpt-5.6-luna');
    expect(loaded.maxOutputTokens).toBe(4096);
    expect(loaded.openaiReasoningEffort).toBe('none');
  });

  it.each([
    'gpt-5-mini', 'gpt-5', 'gpt-5-nano', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'gpt-5.4', 'gpt-5.4-mini',
  ])('migrates and persists deprecated OpenAI model %s without changing unrelated settings', (model) => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      ...DEFAULT_CONFIG,
      provider: 'openai',
      model,
      apiKey: 'secret-key',
      factsCount: 7,
      rotationInterval: 30,
      prompt: 'Custom prompt',
      maxOutputTokens: 4096,
      openaiReasoningEffort: 'high',
    }));

    const loaded = new FactsConfigStore(TEST_CONFIG_PATH).get();
    const persisted = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'));
    expect(loaded).toMatchObject({
      provider: 'openai', model: 'gpt-5.6-luna', apiKey: 'secret-key', factsCount: 7,
      rotationInterval: 30, prompt: 'Custom prompt', maxOutputTokens: 4096,
      openaiReasoningEffort: 'none',
    });
    expect(persisted).toMatchObject({ model: 'gpt-5.6-luna', openaiReasoningEffort: 'none' });
    expect(info.mock.calls.flat().join(' ')).toContain(`${model} to gpt-5.6-luna`);
    expect(info.mock.calls.flat().join(' ')).not.toContain('secret-key');
    info.mockRestore();
  });

  it('canonicalizes the GPT-5.6 alias to Sol while preserving reasoning effort', () => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      ...DEFAULT_CONFIG, provider: 'openai', model: 'gpt-5.6', openaiReasoningEffort: 'high',
    }));

    const loaded = new FactsConfigStore(TEST_CONFIG_PATH).get();
    expect(loaded.model).toBe('gpt-5.6-sol');
    expect(loaded.openaiReasoningEffort).toBe('high');
    expect(JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8')).model).toBe('gpt-5.6-sol');
  });

  it.each([
    'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.5', 'gpt-6-astra', 'vendor/custom-model',
  ])('preserves current or custom OpenAI model %s', (model) => {
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      ...DEFAULT_CONFIG, provider: 'openai', model, openaiReasoningEffort: 'high',
    }));
    const loaded = new FactsConfigStore(TEST_CONFIG_PATH).get();
    expect(loaded.model).toBe(model);
    if (model === 'vendor/custom-model') {
      expect(loaded.openaiReasoningEffort).toBeUndefined();
      expect(JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8')).openaiReasoningEffort).toBe('high');
    } else {
      expect(loaded.openaiReasoningEffort).toBe('high');
    }
  });

  it.each(['anthropic', 'openrouter', 'local'] as const)(
    'does not migrate model IDs for the %s provider',
    (provider) => {
      fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ ...DEFAULT_CONFIG, provider, model: 'gpt-4o' }));
      expect(new FactsConfigStore(TEST_CONFIG_PATH).get().model).toBe('gpt-4o');
    },
  );

  it('migrates deprecated model IDs submitted by an old UI before persisting', () => {
    store.update({
      provider: 'openai', model: 'gpt-4o-mini', openaiReasoningEffort: 'high', maxOutputTokens: 3072,
    });

    expect(store.get()).toMatchObject({
      provider: 'openai', model: 'gpt-5.6-luna', openaiReasoningEffort: 'none', maxOutputTokens: 3072,
    });
    expect(JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'))).toMatchObject({
      model: 'gpt-5.6-luna', openaiReasoningEffort: 'none', maxOutputTokens: 3072,
    });
  });

  it('should reject API key updates containing non-ASCII characters', () => {
    // Masked keys contain bullet points (character 8226)
    const maskedKey = '••••••••1234';
    store.update({ apiKey: maskedKey });

    const config = store.get();
    expect(config.apiKey).toBe(''); // Should not be saved
  });

  it('should accept valid ASCII API keys', () => {
    const validKey = 'sk-ant-api03-test-key-12345';
    store.update({ apiKey: validKey });

    const config = store.get();
    expect(config.apiKey).toBe(validKey);
  });

  it('trims local base URL updates before storage and use', () => {
    store.update({ localBaseUrl: '  http://localhost:11434/v1  ' });

    expect(store.get().localBaseUrl).toBe('http://localhost:11434/v1');
    expect(JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8')).localBaseUrl)
      .toBe('http://localhost:11434/v1');
  });

  it('should clear corrupted API key on load', () => {
    // Manually write a corrupted config file
    const corruptedConfig = {
      ...DEFAULT_CONFIG,
      apiKey: '••••••••abcd', // Contains bullet points
    };
    fs.writeFileSync(TEST_CONFIG_PATH, JSON.stringify(corruptedConfig));

    // New instance should clear the corrupted key
    const store2 = new FactsConfigStore(TEST_CONFIG_PATH);
    const config = store2.get();
    expect(config.apiKey).toBe(''); // Should be cleared
  });

  describe('OpenRouter and Local LLM Providers', () => {
    it('should return OpenRouter API key from environment', () => {
      process.env.OPENROUTER_API_KEY = 'or-test-key';
      const store = new FactsConfigStore(TEST_CONFIG_PATH);
      store.update({ provider: 'openrouter' });

      const config = store.get();
      expect(config.apiKey).toBe('or-test-key');

      delete process.env.OPENROUTER_API_KEY;
    });

    it('should return localBaseUrl from environment for local provider', () => {
      process.env.LOCAL_LLM_URL = '  http://localhost:1234/v1  ';
      const store = new FactsConfigStore(TEST_CONFIG_PATH);
      store.update({ provider: 'local' });

      const config = store.get();
      expect(config.localBaseUrl).toBe('http://localhost:1234/v1');

      delete process.env.LOCAL_LLM_URL;
    });

    it('should use default localBaseUrl when not configured', () => {
      const store = new FactsConfigStore(TEST_CONFIG_PATH);
      store.update({ provider: 'local' });

      const config = store.get();
      expect(config.localBaseUrl).toBe('http://localhost:11434/v1');
    });

    it('should not require API key for local provider', () => {
      const store = new FactsConfigStore(TEST_CONFIG_PATH);
      store.update({ provider: 'local', model: 'llama3.1', apiKey: '' });

      expect(store.get().provider).toBe('local');
    });
  });
});
