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

  afterEach(() => {
    if (fs.existsSync(TEST_CACHE_PATH)) {
      fs.unlinkSync(TEST_CACHE_PATH);
    }
    vi.useRealTimers();
  });

  it('should return null for uncached tracks', () => {
    const result = cache.get('Artist', 'Album', 'Title');
    expect(result).toBeNull();
  });

  it('should store and retrieve facts', () => {
    const facts = ['Fact 1', 'Fact 2'];
    cache.set('Artist', 'Album', 'Title', facts);

    const result = cache.get('Artist', 'Album', 'Title');
    expect(result).toEqual(facts);
  });

  it('should normalize keys (case-insensitive)', () => {
    const facts = ['Fact 1'];
    cache.set('ARTIST', 'ALBUM', 'TITLE', facts);

    const result = cache.get('artist', 'album', 'title');
    expect(result).toEqual(facts);
  });

  it('should persist to disk', () => {
    const facts = ['Persisted fact'];
    cache.set('Artist', 'Album', 'Title', facts);

    // Create new instance to test persistence
    const cache2 = new FactsCache(TEST_CACHE_PATH);
    const result = cache2.get('Artist', 'Album', 'Title');
    expect(result).toEqual(facts);
  });

  it('should expire entries after TTL', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const facts = ['Old fact'];
    cache.set('Artist', 'Album', 'Title', facts);

    // Verify it exists before TTL
    expect(cache.get('Artist', 'Album', 'Title')).toEqual(facts);

    // Fast-forward time past TTL
    vi.setSystemTime(now + TTL_MS + 1000);

    const result = cache.get('Artist', 'Album', 'Title');
    expect(result).toBeNull();
  });

  it('should return timestamp for cached entry', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    cache.set('Artist', 'Album', 'Title', ['Fact']);

    const timestamp = cache.getTimestamp('Artist', 'Album', 'Title');
    expect(timestamp).toBe(now);
  });

  it('should return null timestamp for uncached entry', () => {
    const timestamp = cache.getTimestamp('Unknown', 'Artist', 'Track');
    expect(timestamp).toBeNull();
  });

  it('should handle empty facts array', () => {
    cache.set('Artist', 'Album', 'Title', []);

    const result = cache.get('Artist', 'Album', 'Title');
    expect(result).toEqual([]);
  });

  it('should handle special characters in keys', () => {
    const facts = ['Special fact'];
    cache.set("Artist's Name", 'Album (Deluxe)', 'Title: Remix', facts);

    const result = cache.get("Artist's Name", 'Album (Deluxe)', 'Title: Remix');
    expect(result).toEqual(facts);
  });
});
