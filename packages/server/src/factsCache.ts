import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import type { FactsConfig } from '@roon-screen-cover/shared';
import {
  getOpenAIReasoningEffort,
  getRecommendedFactsOutputTokens,
} from '@roon-screen-cover/shared';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_CACHE_PATH = path.join(DATA_DIR, 'facts-cache.json');
const CACHE_VERSION = 2;
const TTL_MS = 72 * 60 * 60 * 1000;
const MAX_ENTRIES = 1_000;
let nextTempFileId = 0;

export interface CachedFacts {
  facts: string[];
  timestamp: number;
}

interface CacheFile {
  version: typeof CACHE_VERSION;
  entries: Record<string, CachedFacts>;
}

function isCacheEntry(value: unknown, now: number): value is CachedFacts {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return Array.isArray(entry.facts)
    && entry.facts.length > 0
    && entry.facts.every((fact) => typeof fact === 'string' && fact.trim().length > 0)
    && typeof entry.timestamp === 'number'
    && Number.isFinite(entry.timestamp)
    && entry.timestamp <= now;
}

export class FactsCache {
  private cache = new Map<string, CachedFacts>();
  private readonly cachePath: string;
  private dirty = false;
  private writePromise: Promise<void> | null = null;

  constructor(cachePath: string = DEFAULT_CACHE_PATH) {
    this.cachePath = cachePath;
    this.load();
  }

  makeKey(artist: string, album: string, title: string, config: FactsConfig): string {
    const normalizedTrack = [artist, album, title].map((part) => part.trim().toLowerCase());
    const effectiveReasoning = config.provider === 'openai'
      ? getOpenAIReasoningEffort(config.model, config.openaiReasoningEffort)
      : undefined;
    const generationFingerprint = [
      config.provider,
      config.model,
      config.prompt,
      config.factsCount,
      config.maxOutputTokens ?? getRecommendedFactsOutputTokens(config.provider, config.model),
      effectiveReasoning ?? null,
      config.provider === 'local' ? config.localBaseUrl ?? null : null,
    ];
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(generationFingerprint))
      .digest('hex');
    return `${JSON.stringify(normalizedTrack)}:${fingerprint}`;
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.cachePath)) return;
      const parsed: unknown = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
        || (parsed as Partial<CacheFile>).version !== CACHE_VERSION
        || typeof (parsed as Partial<CacheFile>).entries !== 'object'
        || (parsed as Partial<CacheFile>).entries === null) {
        logger.info('Discarding legacy facts cache without generation configuration provenance');
        this.schedulePersist();
        return;
      }

      const now = Date.now();
      let pruned = false;
      for (const [key, value] of Object.entries((parsed as CacheFile).entries)) {
        if (!isCacheEntry(value, now) || now - value.timestamp > TTL_MS) {
          pruned = true;
          continue;
        }
        this.cache.set(key, value);
      }
      if (this.enforceCap()) pruned = true;
      if (pruned) this.schedulePersist();
      logger.info(`Loaded ${this.cache.size} cached facts from ${this.cachePath}`);
    } catch {
      logger.error('Failed to load facts cache');
    }
  }

  private enforceCap(): boolean {
    if (this.cache.size <= MAX_ENTRIES) return false;
    const oldest = [...this.cache.entries()]
      .sort((left, right) => left[1].timestamp - right[1].timestamp)
      .slice(0, this.cache.size - MAX_ENTRIES);
    for (const [key] of oldest) this.cache.delete(key);
    return oldest.length > 0;
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
      const snapshot: CacheFile = { version: CACHE_VERSION, entries: Object.fromEntries(this.cache) };
      const directory = path.dirname(this.cachePath);
      const tempPath = `${this.cachePath}.${process.pid}.${nextTempFileId += 1}.tmp`;
      try {
        await fs.promises.mkdir(directory, { recursive: true });
        await fs.promises.writeFile(tempPath, JSON.stringify(snapshot, null, 2));
        await fs.promises.rename(tempPath, this.cachePath);
      } catch {
        logger.error('Failed to save facts cache');
        await fs.promises.unlink(tempPath).catch(() => undefined);
      }
    }
  }

  private pruneExpired(): boolean {
    const now = Date.now();
    let pruned = false;
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > TTL_MS) {
        this.cache.delete(key);
        pruned = true;
      }
    }
    return pruned;
  }

  getEntry(artist: string, album: string, title: string, config: FactsConfig): CachedFacts | null {
    const key = this.makeKey(artist, album, title, config);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.cache.delete(key);
      this.schedulePersist();
      return null;
    }
    return { facts: entry.facts, timestamp: entry.timestamp };
  }

  get(artist: string, album: string, title: string, config: FactsConfig): string[] | null {
    return this.getEntry(artist, album, title, config)?.facts ?? null;
  }

  set(
    artist: string,
    album: string,
    title: string,
    facts: string[],
    config: FactsConfig,
    timestamp: number = Date.now(),
  ): void {
    this.cache.set(this.makeKey(artist, album, title, config), { facts, timestamp });
    this.enforceCap();
    this.schedulePersist();
  }

  getTimestamp(artist: string, album: string, title: string, config: FactsConfig): number | null {
    return this.getEntry(artist, album, title, config)?.timestamp ?? null;
  }

  async flush(): Promise<void> {
    while (this.writePromise) await this.writePromise;
  }
}
