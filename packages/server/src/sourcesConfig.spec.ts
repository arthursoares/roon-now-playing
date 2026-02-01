/**
 * Test Plan: SourcesConfigStore
 *
 * Scenario: Load default config when no file exists
 *   Given no config file exists at the specified path
 *   When a new SourcesConfigStore is created
 *   Then it should return default configuration values
 *   And requireApiKey should be false
 *   And apiKey should be empty string
 *
 * Scenario: Generate a new API key
 *   Given a SourcesConfigStore instance
 *   When generateApiKey is called
 *   Then it should return a UUID-formatted key
 *   And the key should be persisted in the config
 *
 * Scenario: Validate API keys
 *   Given a SourcesConfigStore with an API key set
 *   When validateApiKey is called with the correct key
 *   Then it should return true
 *   When validateApiKey is called with an incorrect key
 *   Then it should return false
 *
 * Scenario: Persist config changes to file
 *   Given a SourcesConfigStore instance
 *   When config is updated and a new instance is created
 *   Then the new instance should load the persisted values
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SourcesConfigStore } from './sourcesConfig.js';

const TEST_CONFIG_PATH = path.join(process.cwd(), 'test-sources-config.json');

describe('SourcesConfigStore', () => {
  let store: SourcesConfigStore;

  beforeEach(() => {
    // Clean up any existing test file
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    store = new SourcesConfigStore(TEST_CONFIG_PATH);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it('should return default config when no file exists', () => {
    const config = store.get();
    expect(config.requireApiKey).toBe(false);
    expect(config.apiKey).toBe('');
  });

  it('should generate a new API key', () => {
    const key = store.generateApiKey();
    expect(key).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    expect(store.get().apiKey).toBe(key);
  });

  it('should validate correct API key', () => {
    const key = store.generateApiKey();
    expect(store.validateApiKey(key)).toBe(true);
    expect(store.validateApiKey('wrong-key')).toBe(false);
  });

  it('should return false when validating with no API key set', () => {
    expect(store.validateApiKey('any-key')).toBe(false);
  });

  it('should persist config to file', () => {
    store.update({ requireApiKey: true });
    store.generateApiKey();

    // Create new instance to verify persistence
    const store2 = new SourcesConfigStore(TEST_CONFIG_PATH);
    expect(store2.get().requireApiKey).toBe(true);
    expect(store2.get().apiKey).toBeTruthy();
  });

  it('should merge partial updates', () => {
    store.update({ requireApiKey: true });
    const key = store.generateApiKey();

    const config = store.get();
    expect(config.requireApiKey).toBe(true);
    expect(config.apiKey).toBe(key);
  });

  it('should report whether auth is required', () => {
    expect(store.isAuthRequired()).toBe(false);

    store.update({ requireApiKey: true });
    expect(store.isAuthRequired()).toBe(true);
  });
});
