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

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FactsConfigStore, DEFAULT_CONFIG } from './factsConfig.js';

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
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it('should return default config when no file exists', () => {
    const config = store.get();
    expect(config.provider).toBe('anthropic');
    expect(config.factsCount).toBe(5);
    expect(config.rotationInterval).toBe(25);
  });

  it('should save and load config', () => {
    store.update({ factsCount: 7 });

    // Create new instance to verify persistence
    const store2 = new FactsConfigStore(TEST_CONFIG_PATH);
    const config = store2.get();
    expect(config.factsCount).toBe(7);
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
    expect(DEFAULT_CONFIG.model).toBe('claude-sonnet-4-20250514');
    expect(DEFAULT_CONFIG.apiKey).toBe('');
    expect(DEFAULT_CONFIG.factsCount).toBe(5);
    expect(DEFAULT_CONFIG.rotationInterval).toBe(25);
    expect(DEFAULT_CONFIG.prompt).toContain('Generate');
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
      process.env.LOCAL_LLM_URL = 'http://localhost:1234/v1';
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
