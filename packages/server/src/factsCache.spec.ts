/**
 * Test Plan: FactsCache
 *
 * Scenario: Return null for uncached tracks
 *   Given a cache with no entries
 *   When get is called for any track
 *   Then it should return null
 *
 * Scenario: Store and retrieve facts
 *   Given a cache instance
 *   When facts are stored for a track
 *   Then the same facts should be retrievable
 *
 * Scenario: Normalize keys (case-insensitive)
 *   Given facts stored with uppercase keys
 *   When retrieving with lowercase keys
 *   Then the facts should be found
 *
 * Scenario: Persist to disk
 *   Given facts stored in a cache
 *   When a new cache instance is created
 *   Then it should load the persisted facts
 *
 * Scenario: Expire entries after TTL
 *   Given facts stored in the cache
 *   When time advances past the 72-hour TTL
 *   Then the facts should no longer be retrievable
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FactsCache } from './factsCache.js';
import { DEFAULT_CONFIG } from './factsConfig.js';

const TEST_CACHE_PATH = path.join(process.cwd(), 'test-facts-cache.json');
const TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

describe('FactsCache', () => {
  let cache: FactsCache;

  beforeEach(() => {
    if (fs.existsSync(TEST_CACHE_PATH)) {
      fs.unlinkSync(TEST_CACHE_PATH);
    }
    cache = new FactsCache(TEST_CACHE_PATH);
  });

  afterEach(async () => {
    await cache.flush();
    if (fs.existsSync(TEST_CACHE_PATH)) {
      fs.unlinkSync(TEST_CACHE_PATH);
    }
    vi.useRealTimers();
  });

  it('should return null for uncached tracks', () => {
    const result = cache.get('Artist', 'Album', 'Title', DEFAULT_CONFIG);
    expect(result).toBeNull();
  });

  it('should store and retrieve facts', () => {
    const facts = ['Fact 1', 'Fact 2'];
    cache.set('Artist', 'Album', 'Title', facts, DEFAULT_CONFIG);

    const result = cache.get('Artist', 'Album', 'Title', DEFAULT_CONFIG);
    expect(result).toEqual(facts);
  });

  it('should normalize keys (case-insensitive)', () => {
    const facts = ['Fact 1'];
    cache.set('  ARTIST ', ' ALBUM ', ' TITLE  ', facts, DEFAULT_CONFIG);

    const result = cache.get('artist', 'album', 'title', DEFAULT_CONFIG);
    expect(result).toEqual(facts);
  });

  it('should persist to disk', async () => {
    const facts = ['Persisted fact'];
    cache.set('Artist', 'Album', 'Title', facts, DEFAULT_CONFIG);
    await cache.flush();

    // Create new instance to test persistence
    const cache2 = new FactsCache(TEST_CACHE_PATH);
    const result = cache2.get('Artist', 'Album', 'Title', DEFAULT_CONFIG);
    expect(result).toEqual(facts);
  });

  it('should expire entries after TTL', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const facts = ['Old fact'];
    cache.set('Artist', 'Album', 'Title', facts, DEFAULT_CONFIG);

    // Verify it exists before TTL
    expect(cache.get('Artist', 'Album', 'Title', DEFAULT_CONFIG)).toEqual(facts);

    // Fast-forward time past TTL
    vi.setSystemTime(now + TTL_MS + 1000);

    const result = cache.get('Artist', 'Album', 'Title', DEFAULT_CONFIG);
    expect(result).toBeNull();
  });

  it('should return timestamp for cached entry', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    cache.set('Artist', 'Album', 'Title', ['Fact'], DEFAULT_CONFIG);

    const timestamp = cache.getTimestamp('Artist', 'Album', 'Title', DEFAULT_CONFIG);
    expect(timestamp).toBe(now);
  });

  it('should return null timestamp for uncached entry', () => {
    const timestamp = cache.getTimestamp('Unknown', 'Artist', 'Track', DEFAULT_CONFIG);
    expect(timestamp).toBeNull();
  });

  it('should handle empty facts array', () => {
    cache.set('Artist', 'Album', 'Title', [], DEFAULT_CONFIG);

    const result = cache.get('Artist', 'Album', 'Title', DEFAULT_CONFIG);
    expect(result).toEqual([]);
  });

  it('should handle special characters in keys', () => {
    const facts = ['Special fact'];
    cache.set("Artist's Name", 'Album (Deluxe)', 'Title: Remix', facts, DEFAULT_CONFIG);

    const result = cache.get("Artist's Name", 'Album (Deluxe)', 'Title: Remix', DEFAULT_CONFIG);
    expect(result).toEqual(facts);
  });

  it('separates generation-affecting config but ignores API key and rotation changes', () => {
    cache.set('Artist', 'Album', 'Title', ['Original'], DEFAULT_CONFIG);
    expect(cache.get('Artist', 'Album', 'Title', {
      ...DEFAULT_CONFIG, apiKey: 'rotated-key', rotationInterval: 60,
    })).toEqual(['Original']);
    expect(cache.get('Artist', 'Album', 'Title', {
      ...DEFAULT_CONFIG, prompt: 'A different prompt',
    })).toBeNull();
  });

  it('fingerprints effective model defaults rather than unsupported saved reasoning', () => {
    const originalGpt5 = {
      ...DEFAULT_CONFIG,
      provider: 'openai' as const,
      model: 'gpt-5-mini',
      maxOutputTokens: undefined,
      openaiReasoningEffort: 'none' as const,
    };
    cache.set('Artist', 'Album', 'Title', ['Original GPT-5'], originalGpt5);
    expect(cache.get('Artist', 'Album', 'Title', {
      ...originalGpt5,
      maxOutputTokens: 8192,
      openaiReasoningEffort: 'minimal',
    })).toEqual(['Original GPT-5']);
  });

  it('ignores local base URL for cloud providers but distinguishes it for local generation', () => {
    const cloud = { ...DEFAULT_CONFIG, provider: 'openai' as const, model: 'gpt-5.6-luna' };
    cache.set('Artist', 'Album', 'Cloud', ['Cloud fact'], cloud);
    expect(cache.get('Artist', 'Album', 'Cloud', {
      ...cloud, localBaseUrl: 'http://unrelated-host:9999/v1',
    })).toEqual(['Cloud fact']);

    const local = { ...DEFAULT_CONFIG, provider: 'local' as const, model: 'local-model' };
    cache.set('Artist', 'Album', 'Local', ['Local fact'], local);
    expect(cache.get('Artist', 'Album', 'Local', {
      ...local, localBaseUrl: 'http://other-host:11434/v1',
    })).toBeNull();
  });

  it('uses unambiguous track key encoding', () => {
    cache.set('a::b', 'c', 'd', ['First'], DEFAULT_CONFIG);
    cache.set('a', 'b::c', 'd', ['Second'], DEFAULT_CONFIG);
    expect(cache.get('a::b', 'c', 'd', DEFAULT_CONFIG)).toEqual(['First']);
    expect(cache.get('a', 'b::c', 'd', DEFAULT_CONFIG)).toEqual(['Second']);
  });

  it('drops legacy cache files without configuration provenance', () => {
    fs.writeFileSync(TEST_CACHE_PATH, JSON.stringify({
      'artist::album::title': { facts: ['Legacy'], timestamp: Date.now() },
    }));
    cache = new FactsCache(TEST_CACHE_PATH);
    expect(cache.get('artist', 'album', 'title', DEFAULT_CONFIG)).toBeNull();
  });

  it('prunes expired entries while loading', async () => {
    const key = cache.makeKey('Artist', 'Album', 'Title', DEFAULT_CONFIG);
    fs.writeFileSync(TEST_CACHE_PATH, JSON.stringify({
      version: 2,
      entries: { [key]: { facts: ['Expired'], timestamp: Date.now() - TTL_MS - 1 } },
    }));
    cache = new FactsCache(TEST_CACHE_PATH);
    expect(cache.get('Artist', 'Album', 'Title', DEFAULT_CONFIG)).toBeNull();
    await cache.flush();
    expect(JSON.parse(fs.readFileSync(TEST_CACHE_PATH, 'utf8')).entries).toEqual({});
  });

  it('prunes unusable and future-dated entries while loading', async () => {
    const now = Date.now();
    const validKey = cache.makeKey('Artist', 'Album', 'Valid', DEFAULT_CONFIG);
    const emptyKey = cache.makeKey('Artist', 'Album', 'Empty', DEFAULT_CONFIG);
    const blankKey = cache.makeKey('Artist', 'Album', 'Blank', DEFAULT_CONFIG);
    const futureKey = cache.makeKey('Artist', 'Album', 'Future', DEFAULT_CONFIG);
    fs.writeFileSync(TEST_CACHE_PATH, JSON.stringify({
      version: 2,
      entries: {
        [validKey]: { facts: ['Valid fact'], timestamp: now },
        [emptyKey]: { facts: [], timestamp: now },
        [blankKey]: { facts: ['   '], timestamp: now },
        [futureKey]: { facts: ['Future fact'], timestamp: now + 60_000 },
      },
    }));
    cache = new FactsCache(TEST_CACHE_PATH);

    expect(cache.get('Artist', 'Album', 'Valid', DEFAULT_CONFIG)).toEqual(['Valid fact']);
    expect(cache.get('Artist', 'Album', 'Empty', DEFAULT_CONFIG)).toBeNull();
    expect(cache.get('Artist', 'Album', 'Blank', DEFAULT_CONFIG)).toBeNull();
    expect(cache.get('Artist', 'Album', 'Future', DEFAULT_CONFIG)).toBeNull();
    await cache.flush();
    expect(Object.keys(JSON.parse(fs.readFileSync(TEST_CACHE_PATH, 'utf8')).entries)).toEqual([validKey]);
  });

  it('caps the cache at 1000 newest entries and persists the cap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    for (let index = 0; index < 1005; index += 1) {
      vi.setSystemTime(1_000_000 + index);
      cache.set('Artist', 'Album', `Title ${index}`, [`Fact ${index}`], DEFAULT_CONFIG);
    }
    expect(cache.get('Artist', 'Album', 'Title 0', DEFAULT_CONFIG)).toBeNull();
    expect(cache.get('Artist', 'Album', 'Title 1004', DEFAULT_CONFIG)).toEqual(['Fact 1004']);
    await cache.flush();
    expect(Object.keys(JSON.parse(fs.readFileSync(TEST_CACHE_PATH, 'utf8')).entries)).toHaveLength(1000);
  });
});
