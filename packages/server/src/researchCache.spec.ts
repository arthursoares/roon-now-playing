import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FactsConfig, FactsRequest } from '@roon-screen-cover/shared';
import {
  ResearchCache,
  researchRecordRevision,
  type CachedResearchRecord,
} from './researchCache.js';

const CACHE_PATH = path.join(process.cwd(), 'test-codex-research-cache.json');
const NOW = 2_000_000_000_000;
const metadata: FactsRequest = { artist: 'Artist', album: 'Album', title: 'Track' };
const config: FactsConfig = {
  provider: 'codex',
  model: 'gpt-5.6-luna',
  apiKey: '',
  factsCount: 3,
  rotationInterval: 30,
  prompt: 'Write sourced facts',
  maxOutputTokens: 4096,
  openaiReasoningEffort: 'high',
};

function record(timestamp = NOW, text = 'Album fact'): CachedResearchRecord {
  return {
    facts: [{
      text,
      scope: 'album',
      trackTitle: null,
      sourceUrls: ['https://example.com/source'],
    }],
    sources: [{ url: 'https://example.com/source', title: 'Source' }],
    timestamp,
  };
}

describe('ResearchCache', () => {
  let cache: ResearchCache;

  beforeEach(() => {
    fs.rmSync(CACHE_PATH, { force: true });
    cache = new ResearchCache({ cachePath: CACHE_PATH, now: () => NOW });
  });

  afterEach(async () => {
    await cache.flush();
    fs.rmSync(CACHE_PATH, { force: true });
  });

  it('uses opaque account, identity, and generation-aware keys', () => {
    const first = cache.makeResearchKey('secret-account', metadata, config);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('secret-account');
    expect(first).not.toContain(config.prompt);
    expect(cache.makeResearchKey('secret-account', {
      artist: '  ARTIST', album: 'album  ', title: 'Other Track',
    }, { ...config, apiKey: 'ignored', maxOutputTokens: 1, openaiReasoningEffort: 'low' })).toBe(first);
    expect(cache.makeResearchKey('other-account', metadata, config)).not.toBe(first);
    expect(cache.makeResearchKey('secret-account', { ...metadata, album: 'Other Album' }, config)).not.toBe(first);
    expect(cache.makeResearchKey('secret-account', metadata, { ...config, prompt: 'Different' })).not.toBe(first);
    expect(cache.makeResearchKey('secret-account', metadata, config, 'track')).not.toBe(first);
    expect(cache.makeTrackKey('secret-account', metadata, config)).not.toBe(
      cache.makeTrackKey('secret-account', { ...metadata, title: 'Other Track' }, config),
    );
  });

  it('persists source-aware research and aligned track results', async () => {
    const researchKey = cache.makeResearchKey('account', metadata, config);
    const trackKey = cache.makeTrackKey('account', metadata, config);
    expect(cache.setResearch(researchKey, record())).toBe(true);
    expect(cache.setTrack(trackKey, {
      facts: ['Album fact'],
      sources: [[{ url: 'https://example.com/source', title: 'Source' }]],
      timestamp: NOW,
      generatedAt: NOW,
      researchRevision: researchRecordRevision(record()),
    })).toBe(true);
    await cache.flush();

    const reloaded = new ResearchCache({ cachePath: CACHE_PATH, now: () => NOW });
    expect(reloaded.getResearch(researchKey)).toEqual(record());
    expect(reloaded.getTrack(trackKey)).toEqual({
      facts: ['Album fact'],
      sources: [[{ url: 'https://example.com/source', title: 'Source' }]],
      timestamp: NOW,
      generatedAt: NOW,
      researchRevision: researchRecordRevision(record()),
    });
  });

  it('rejects empty, unattributed, insecure, and wrongly scoped records', () => {
    const key = cache.makeResearchKey('account', metadata, config);
    expect(cache.setResearch(key, { ...record(), facts: [] })).toBe(false);
    expect(cache.setResearch(key, {
      ...record(),
      facts: [{ ...record().facts[0], sourceUrls: ['https://foreign.example/source'] }],
    })).toBe(false);
    expect(cache.setResearch(key, {
      ...record(), sources: [{ url: 'http://example.com/source', title: 'Source' }],
    })).toBe(false);
    expect(cache.setResearch(key, {
      ...record(),
      facts: [{ ...record().facts[0], sourceUrls: ['https://localhost/source'] }],
      sources: [{ url: 'https://localhost/source', title: 'Private' }],
    })).toBe(false);
    expect(cache.setResearch(key, {
      ...record(),
      facts: [{ ...record().facts[0], sourceUrls: ['https://user:password@example.com/source'] }],
      sources: [{ url: 'https://user:password@example.com/source', title: 'Credentials' }],
    })).toBe(false);
    expect(cache.setResearch(key, {
      ...record(), facts: [{ ...record().facts[0], scope: 'track', trackTitle: null }],
    })).toBe(false);
    expect(cache.setTrack(key, {
      facts: ['Fact'], sources: [], timestamp: NOW, generatedAt: NOW,
      researchRevision: researchRecordRevision(record()),
    })).toBe(false);
  });

  it('prunes expired, future-dated, and invalid-source entries when loading', async () => {
    const validKey = cache.makeResearchKey('account', metadata, config);
    const expiredKey = cache.makeResearchKey('account', { ...metadata, album: 'Expired' }, config);
    const futureKey = cache.makeResearchKey('account', { ...metadata, album: 'Future' }, config);
    const invalidSourceKey = cache.makeResearchKey('account', { ...metadata, album: 'Invalid' }, config);
    const expiredTrackKey = cache.makeTrackKey('account', { ...metadata, title: 'Expired' }, config);
    fs.writeFileSync(CACHE_PATH, JSON.stringify({
      version: 2,
      researchEntries: {
        [validKey]: record(),
        'prompt=plaintext': record(),
        [expiredKey]: record(NOW - 30 * 24 * 60 * 60 * 1000 - 1),
        [futureKey]: record(NOW + 1),
        [invalidSourceKey]: { ...record(), sources: [{ url: 'javascript:alert(1)', title: 'Bad' }] },
      },
      trackEntries: {
        [expiredTrackKey]: {
          facts: ['Old'],
          sources: [[{ url: 'https://example.com/source', title: 'Source' }]],
          timestamp: NOW - 72 * 60 * 60 * 1000 - 1,
          generatedAt: NOW - 72 * 60 * 60 * 1000 - 1,
          researchRevision: researchRecordRevision(record()),
        },
      },
    }));
    cache = new ResearchCache({ cachePath: CACHE_PATH, now: () => NOW });
    expect(cache.getResearch(validKey)).toEqual(record());
    expect(cache.getResearch('prompt=plaintext')).toBeNull();
    expect(cache.getResearch(expiredKey)).toBeNull();
    expect(cache.getResearch(futureKey)).toBeNull();
    expect(cache.getResearch(invalidSourceKey)).toBeNull();
    expect(cache.getTrack(expiredTrackKey)).toBeNull();
    await cache.flush();
    const persisted = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as {
      researchEntries: Record<string, unknown>;
      trackEntries: Record<string, unknown>;
    };
    expect(Object.keys(persisted.researchEntries)).toEqual([validKey]);
    expect(persisted.trackEntries).toEqual({});
  });

  it('keeps only the 500 newest research records on load', async () => {
    const researchEntries = Object.fromEntries(Array.from({ length: 505 }, (_, index) => [
      cache.makeResearchKey('account', { ...metadata, album: `Album ${index}` }, config),
      record(NOW - 505 + index, `Fact ${index}`),
    ]));
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ version: 2, researchEntries, trackEntries: {} }));
    cache = new ResearchCache({ cachePath: CACHE_PATH, now: () => NOW });
    expect(cache.getResearch(cache.makeResearchKey('account', { ...metadata, album: 'Album 0' }, config))).toBeNull();
    expect(cache.getResearch(cache.makeResearchKey('account', { ...metadata, album: 'Album 4' }, config))).toBeNull();
    expect(cache.getResearch(cache.makeResearchKey('account', { ...metadata, album: 'Album 5' }, config))).not.toBeNull();
    expect(cache.getResearch(cache.makeResearchKey('account', { ...metadata, album: 'Album 504' }, config))).not.toBeNull();
    await cache.flush();
    const persisted = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as { researchEntries: object };
    expect(Object.keys(persisted.researchEntries)).toHaveLength(500);
  });

  it('keeps only the 1000 newest selected track results on load', async () => {
    const trackEntries = Object.fromEntries(Array.from({ length: 1_005 }, (_, index) => [
      cache.makeTrackKey('account', { ...metadata, title: `Track ${index}` }, config),
      {
        facts: [`Fact ${index}`],
        sources: [[{ url: 'https://example.com/source', title: 'Source' }]],
        timestamp: NOW - 1_005 + index,
        generatedAt: NOW - 1_005 + index,
        researchRevision: researchRecordRevision(record()),
      },
    ]));
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ version: 2, researchEntries: {}, trackEntries }));
    cache = new ResearchCache({ cachePath: CACHE_PATH, now: () => NOW });
    expect(cache.getTrack(cache.makeTrackKey('account', { ...metadata, title: 'Track 4' }, config))).toBeNull();
    expect(cache.getTrack(cache.makeTrackKey('account', { ...metadata, title: 'Track 5' }, config))).not.toBeNull();
    await cache.flush();
    const persisted = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as { trackEntries: object };
    expect(Object.keys(persisted.trackEntries)).toHaveLength(1_000);
  });

  it('rejects an individual cache record larger than 256 KiB', () => {
    const key = cache.makeResearchKey('account', metadata, config);
    expect(cache.setResearch(key, record(NOW, 'x'.repeat(257 * 1024)))).toBe(false);
    expect(cache.getResearch(key)).toBeNull();
  });

  it('invalidates both cache layers and persists the empty state', async () => {
    const researchKey = cache.makeResearchKey('account', metadata, config);
    const trackKey = cache.makeTrackKey('account', metadata, config);
    cache.setResearch(researchKey, record());
    cache.setTrack(trackKey, {
      facts: ['Fact'],
      sources: [[{ url: 'https://example.com/source', title: 'Source' }]],
      timestamp: NOW,
      generatedAt: NOW,
      researchRevision: researchRecordRevision(record()),
    });
    await cache.invalidate();
    expect(cache.getResearch(researchKey)).toBeNull();
    expect(cache.getTrack(trackKey)).toBeNull();
    expect(JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))).toEqual({
      version: 2, researchEntries: {}, trackEntries: {},
    });
  });
});
