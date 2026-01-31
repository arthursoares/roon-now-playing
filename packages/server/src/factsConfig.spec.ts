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
});
