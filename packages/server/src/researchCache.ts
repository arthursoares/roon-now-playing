import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { FactSource, FactsConfig, FactsRequest } from '@roon-screen-cover/shared';
import { normalizeFactSourceUrl } from '@roon-screen-cover/shared';
import type { SourcedResearchFact } from './codexResearchTypes.js';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_CACHE_PATH = path.join(DATA_DIR, 'codex-research-cache.json');
const CACHE_VERSION = 2;
const KEY_VERSION = 1;
const RESEARCH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TRACK_TTL_MS = 72 * 60 * 60 * 1000;
const MAX_RESEARCH_ENTRIES = 500;
const MAX_TRACK_ENTRIES = 1_000;
const MAX_ENTRY_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_FILE_BYTES = MAX_TOTAL_BYTES + (2 * 1024 * 1024);
let nextTempFileId = 0;

export interface CachedResearchRecord {
  facts: SourcedResearchFact[];
  sources: FactSource[];
  timestamp: number;
}

export interface CachedTrackResearchResult {
  facts: string[];
  sources: FactSource[][];
  /** Time this deterministic track selection was cached. */
  timestamp: number;
  /** Conservative research timestamp exposed to clients as generatedAt. */
  generatedAt: number;
  /** Content revision of the research record used for this selection. */
  researchRevision: string;
}

interface CacheFile {
  version: typeof CACHE_VERSION;
  researchEntries: Record<string, CachedResearchRecord>;
  trackEntries: Record<string, CachedTrackResearchResult>;
}

export interface ResearchCacheOptions {
  cachePath?: string;
  now?: () => number;
}

function normalizeIdentityPart(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function hashKey(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function researchRecordRevision(record: CachedResearchRecord): string {
  return hashKey([record.facts, record.sources]);
}

function isCacheKey(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isSource(value: unknown): value is FactSource {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  if (typeof source.url !== 'string' || typeof source.title !== 'string' || source.title.trim() === '') return false;
  return normalizeFactSourceUrl(source.url) === source.url;
}

function isTimestamp(value: unknown, now: number, ttl: number): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value <= now
    && now - value <= ttl;
}

function isResearchFact(value: unknown, sourceUrls: Set<string>): value is SourcedResearchFact {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const fact = value as Record<string, unknown>;
  if (typeof fact.text !== 'string' || fact.text.trim() === '') return false;
  if (fact.scope !== 'artist' && fact.scope !== 'album' && fact.scope !== 'track') return false;
  if (fact.scope === 'track') {
    if (typeof fact.trackTitle !== 'string' || fact.trackTitle.trim() === '') return false;
  } else if (fact.trackTitle !== null) {
    return false;
  }
  return Array.isArray(fact.sourceUrls)
    && fact.sourceUrls.length > 0
    && fact.sourceUrls.every((url) => typeof url === 'string' && sourceUrls.has(url));
}

function withinEntryLimit(value: unknown): boolean {
  return Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_ENTRY_BYTES;
}

function isResearchRecord(value: unknown, now: number): value is CachedResearchRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || !withinEntryLimit(value)) return false;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.sources) || record.sources.length === 0 || !record.sources.every(isSource)) return false;
  const urls = new Set(record.sources.map((source) => (source as FactSource).url));
  return Array.isArray(record.facts)
    && record.facts.length > 0
    && record.facts.every((fact) => isResearchFact(fact, urls))
    && isTimestamp(record.timestamp, now, RESEARCH_TTL_MS);
}

function isTrackResult(value: unknown, now: number): value is CachedTrackResearchResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || !withinEntryLimit(value)) return false;
  const result = value as Record<string, unknown>;
  return Array.isArray(result.facts)
    && result.facts.length > 0
    && result.facts.every((fact) => typeof fact === 'string' && fact.trim() !== '')
    && Array.isArray(result.sources)
    && result.sources.length === result.facts.length
    && result.sources.every((sources) => Array.isArray(sources) && sources.length > 0 && sources.every(isSource))
    && isTimestamp(result.timestamp, now, TRACK_TTL_MS)
    && isTimestamp(result.generatedAt, now, RESEARCH_TTL_MS)
    && (result.generatedAt as number) <= (result.timestamp as number)
    && typeof result.researchRevision === 'string'
    && isCacheKey(result.researchRevision);
}

function cloneResearch(record: CachedResearchRecord): CachedResearchRecord {
  return {
    facts: record.facts.map((fact) => ({ ...fact, sourceUrls: [...fact.sourceUrls] })),
    sources: record.sources.map((source) => ({ ...source })),
    timestamp: record.timestamp,
  };
}

function cloneTrack(result: CachedTrackResearchResult): CachedTrackResearchResult {
  return {
    facts: [...result.facts],
    sources: result.sources.map((sources) => sources.map((source) => ({ ...source }))),
    timestamp: result.timestamp,
    generatedAt: result.generatedAt,
    researchRevision: result.researchRevision,
  };
}

export class ResearchCache {
  private readonly researchEntries = new Map<string, CachedResearchRecord>();
  private readonly trackEntries = new Map<string, CachedTrackResearchResult>();
  private readonly cachePath: string;
  private readonly now: () => number;
  private dirty = false;
  private writePromise: Promise<void> | null = null;

  constructor(options: ResearchCacheOptions | string = {}) {
    this.cachePath = typeof options === 'string' ? options : options.cachePath ?? DEFAULT_CACHE_PATH;
    this.now = typeof options === 'string' ? Date.now : options.now ?? Date.now;
    this.load();
  }

  makeResearchKey(
    accountKey: string,
    metadata: FactsRequest,
    config: FactsConfig,
    focus: 'album' | 'track' = 'album',
  ): string {
    const identity = [normalizeIdentityPart(metadata.artist), normalizeIdentityPart(metadata.album)];
    if (focus === 'track') identity.push(normalizeIdentityPart(metadata.title));
    return hashKey([
      KEY_VERSION,
      'research',
      accountKey,
      focus,
      identity,
      config.model,
      config.prompt,
      config.factsCount,
    ]);
  }

  makeTrackKey(accountKey: string, metadata: FactsRequest, config: FactsConfig): string {
    return hashKey([
      KEY_VERSION,
      'track',
      accountKey,
      [metadata.artist, metadata.album, metadata.title].map(normalizeIdentityPart),
      config.model,
      config.prompt,
      config.factsCount,
    ]);
  }

  getResearch(key: string): CachedResearchRecord | null {
    const record = this.researchEntries.get(key);
    if (!record) return null;
    if (!isTimestamp(record.timestamp, this.now(), RESEARCH_TTL_MS)) {
      this.researchEntries.delete(key);
      this.schedulePersist();
      return null;
    }
    return cloneResearch(record);
  }

  setResearch(key: string, record: CachedResearchRecord): boolean {
    if (!isCacheKey(key) || !isResearchRecord(record, this.now())) return false;
    this.researchEntries.set(key, cloneResearch(record));
    this.enforceBounds();
    this.schedulePersist();
    return this.researchEntries.has(key);
  }

  getTrack(key: string): CachedTrackResearchResult | null {
    const result = this.trackEntries.get(key);
    if (!result) return null;
    const now = this.now();
    if (!isTimestamp(result.timestamp, now, TRACK_TTL_MS)
      || !isTimestamp(result.generatedAt, now, RESEARCH_TTL_MS)) {
      this.trackEntries.delete(key);
      this.schedulePersist();
      return null;
    }
    return cloneTrack(result);
  }

  setTrack(key: string, result: CachedTrackResearchResult): boolean {
    if (!isCacheKey(key) || !isTrackResult(result, this.now())) return false;
    this.trackEntries.set(key, cloneTrack(result));
    this.enforceBounds();
    this.schedulePersist();
    return this.trackEntries.has(key);
  }

  async invalidate(): Promise<void> {
    this.researchEntries.clear();
    this.trackEntries.clear();
    this.schedulePersist();
    await this.flush();
  }

  async flush(): Promise<void> {
    while (this.writePromise) await this.writePromise;
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.cachePath)) return;
      if (fs.statSync(this.cachePath).size > MAX_FILE_BYTES) {
        this.schedulePersist();
        return;
      }
      const parsed: unknown = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.schedulePersist();
        return;
      }
      const file = parsed as Partial<CacheFile>;
      if (file.version !== CACHE_VERSION
        || typeof file.researchEntries !== 'object' || file.researchEntries === null
        || typeof file.trackEntries !== 'object' || file.trackEntries === null) {
        this.schedulePersist();
        return;
      }
      const now = this.now();
      let pruned = false;
      for (const [key, value] of Object.entries(file.researchEntries)) {
        if (isCacheKey(key) && isResearchRecord(value, now)) this.researchEntries.set(key, value);
        else pruned = true;
      }
      for (const [key, value] of Object.entries(file.trackEntries)) {
        if (isCacheKey(key) && isTrackResult(value, now)) this.trackEntries.set(key, value);
        else pruned = true;
      }
      if (this.enforceBounds()) pruned = true;
      if (pruned) this.schedulePersist();
      logger.info(`Loaded ${this.researchEntries.size} research and ${this.trackEntries.size} track facts from the Codex cache`);
    } catch {
      logger.error('Failed to load Codex research cache');
      this.schedulePersist();
    }
  }

  private pruneExpired(): boolean {
    const now = this.now();
    let pruned = false;
    for (const [key, record] of this.researchEntries) {
      if (!isTimestamp(record.timestamp, now, RESEARCH_TTL_MS)) {
        this.researchEntries.delete(key);
        pruned = true;
      }
    }
    for (const [key, result] of this.trackEntries) {
      if (!isTimestamp(result.timestamp, now, TRACK_TTL_MS)) {
        this.trackEntries.delete(key);
        pruned = true;
      }
    }
    return pruned;
  }

  private enforceBounds(): boolean {
    let changed = false;
    changed = this.trimOldest(this.researchEntries, MAX_RESEARCH_ENTRIES) || changed;
    changed = this.trimOldest(this.trackEntries, MAX_TRACK_ENTRIES) || changed;
    while (this.serializedBytes() > MAX_TOTAL_BYTES) {
      const oldestResearch = this.oldest(this.researchEntries);
      const oldestTrack = this.oldest(this.trackEntries);
      if (!oldestResearch && !oldestTrack) break;
      if (!oldestTrack || (oldestResearch && oldestResearch[1] <= oldestTrack[1])) {
        this.researchEntries.delete(oldestResearch![0]);
      } else {
        this.trackEntries.delete(oldestTrack[0]);
      }
      changed = true;
    }
    return changed;
  }

  private trimOldest<T extends { timestamp: number }>(entries: Map<string, T>, maximum: number): boolean {
    if (entries.size <= maximum) return false;
    const toDelete = [...entries.entries()]
      .sort((left, right) => left[1].timestamp - right[1].timestamp)
      .slice(0, entries.size - maximum);
    for (const [key] of toDelete) entries.delete(key);
    return toDelete.length > 0;
  }

  private oldest<T extends { timestamp: number }>(entries: Map<string, T>): [string, number] | null {
    let oldest: [string, number] | null = null;
    for (const [key, value] of entries) {
      if (!oldest || value.timestamp < oldest[1]) oldest = [key, value.timestamp];
    }
    return oldest;
  }

  private serializedBytes(): number {
    return Buffer.byteLength(JSON.stringify({
      version: CACHE_VERSION,
      researchEntries: Object.fromEntries(this.researchEntries),
      trackEntries: Object.fromEntries(this.trackEntries),
    }), 'utf8');
  }

  private schedulePersist(): void {
    this.dirty = true;
    if (this.writePromise) return;
    this.writePromise = Promise.resolve()
      .then(() => this.persistWhileDirty())
      .finally(() => {
        this.writePromise = null;
        if (this.dirty) this.schedulePersist();
      });
  }

  private async persistWhileDirty(): Promise<void> {
    while (this.dirty) {
      this.dirty = false;
      this.pruneExpired();
      this.enforceBounds();
      const snapshot: CacheFile = {
        version: CACHE_VERSION,
        researchEntries: Object.fromEntries(this.researchEntries),
        trackEntries: Object.fromEntries(this.trackEntries),
      };
      const directory = path.dirname(this.cachePath);
      const tempPath = `${this.cachePath}.${process.pid}.${nextTempFileId += 1}.tmp`;
      try {
        await fs.promises.mkdir(directory, { recursive: true });
        await fs.promises.writeFile(tempPath, JSON.stringify(snapshot));
        await fs.promises.rename(tempPath, this.cachePath);
      } catch {
        logger.error('Failed to save Codex research cache');
        await fs.promises.unlink(tempPath).catch(() => undefined);
      }
    }
  }
}
