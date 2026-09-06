import { createHash } from 'node:crypto';
import type {
  FactSource,
  FactsConfig,
  FactsRequest,
  FactsResearchMetrics,
  FactsResponse,
} from '@roon-screen-cover/shared';
import { normalizeFactSourceUrl } from '@roon-screen-cover/shared';
import type {
  CodexResearchClient,
  CodexResearchResult,
  SourcedResearchFact,
} from './codexResearchTypes.js';
import { CodexResearchError } from './codexResearchTypes.js';
import {
  ResearchCache,
  researchRecordRevision,
  type CachedResearchRecord,
  type CachedTrackResearchResult,
} from './researchCache.js';

const MAX_QUEUED_RESEARCH = 4;

export interface CodexFactsServiceOptions {
  client: CodexResearchClient;
  cachePath?: string;
  now?: () => number;
  maxQueuedResearch?: number;
}

interface ResearchJobResult {
  record: CachedResearchRecord;
  metrics: Omit<FactsResearchMetrics, 'cache'>;
}

interface QueueItem {
  epoch: number;
  controller: AbortController;
  run: (signal: AbortSignal) => Promise<ResearchJobResult>;
  resolve: (value: ResearchJobResult) => void;
  reject: (reason: unknown) => void;
  settled: boolean;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function validateResearchResult(result: CodexResearchResult, timestamp: number): ResearchJobResult {
  const sourcesByUrl = new Map<string, FactSource>();
  for (const source of Array.isArray(result.sources) ? result.sources : []) {
    if (typeof source !== 'object' || source === null || Array.isArray(source)) continue;
    const candidate = source as Partial<FactSource>;
    const url = normalizeFactSourceUrl(candidate.url);
    if (typeof candidate.title !== 'string' || candidate.title.trim() === '' || !url || sourcesByUrl.has(url)) continue;
    sourcesByUrl.set(url, { url, title: candidate.title });
  }

  const facts: SourcedResearchFact[] = [];
  const usedUrls = new Set<string>();
  for (const fact of Array.isArray(result.facts) ? result.facts : []) {
    if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) continue;
    if (typeof fact.text !== 'string' || fact.text.trim() === '') continue;
    if (fact.scope !== 'artist' && fact.scope !== 'album' && fact.scope !== 'track') continue;
    if (fact.scope === 'track') {
      const trackTitle = fact.trackTitle;
      if (typeof trackTitle !== 'string' || trackTitle.trim() === '') continue;
    } else if (fact.trackTitle !== null) {
      continue;
    }
    const sourceUrls = [...new Set((Array.isArray(fact.sourceUrls) ? fact.sourceUrls : [])
      .map(normalizeFactSourceUrl)
      .filter((url): url is string => url !== null))]
      .filter((url) => sourcesByUrl.has(url));
    if (sourceUrls.length === 0) continue;
    for (const url of sourceUrls) usedUrls.add(url);
    facts.push({
      text: fact.text.trim(),
      scope: fact.scope,
      trackTitle: fact.scope === 'track' ? fact.trackTitle!.trim() : null,
      sourceUrls,
    });
  }

  if (facts.length === 0) {
    throw new CodexResearchError('no-sources');
  }

  const finiteCount = (value: number): number => Number.isFinite(value) && value >= 0 ? value : 0;
  const metrics: Omit<FactsResearchMetrics, 'cache'> = {
    webSearches: finiteCount(result.webSearches),
    openPages: finiteCount(result.openPages),
    durationMs: finiteCount(result.durationMs),
  };
  if (typeof result.inputTokens === 'number' && Number.isFinite(result.inputTokens) && result.inputTokens >= 0) {
    metrics.inputTokens = result.inputTokens;
  }
  if (typeof result.outputTokens === 'number' && Number.isFinite(result.outputTokens) && result.outputTokens >= 0) {
    metrics.outputTokens = result.outputTokens;
  }
  return {
    record: {
      facts,
      sources: [...sourcesByUrl.values()].filter((source) => usedUrls.has(source.url)),
      timestamp,
    },
    metrics,
  };
}

function mergeMetrics(
  left: Omit<FactsResearchMetrics, 'cache'>,
  right: Omit<FactsResearchMetrics, 'cache'>,
): Omit<FactsResearchMetrics, 'cache'> {
  const merged: Omit<FactsResearchMetrics, 'cache'> = {
    webSearches: left.webSearches + right.webSearches,
    openPages: left.openPages + right.openPages,
    durationMs: left.durationMs + right.durationMs,
  };
  if (left.inputTokens !== undefined && right.inputTokens !== undefined) {
    merged.inputTokens = left.inputTokens + right.inputTokens;
  }
  if (left.outputTokens !== undefined && right.outputTokens !== undefined) {
    merged.outputTokens = left.outputTokens + right.outputTokens;
  }
  return merged;
}

function mergeRecords(left: CachedResearchRecord, right: CachedResearchRecord): CachedResearchRecord {
  const sources = new Map(left.sources.map((source) => [source.url, source]));
  for (const source of right.sources) if (!sources.has(source.url)) sources.set(source.url, source);
  const facts = new Map<string, SourcedResearchFact>();
  for (const fact of [...left.facts, ...right.facts]) {
    const key = JSON.stringify([fact.scope, fact.trackTitle && normalize(fact.trackTitle), normalize(fact.text)]);
    if (!facts.has(key)) facts.set(key, fact);
  }
  return {
    facts: [...facts.values()],
    sources: [...sources.values()],
    timestamp: Math.min(left.timestamp, right.timestamp),
  };
}

function selectFacts(
  record: CachedResearchRecord,
  title: string,
  factsCount: number,
): Pick<CachedTrackResearchResult, 'facts' | 'sources'> | null {
  const normalizedTitle = normalize(title);
  const trackFacts = record.facts.filter((fact) => fact.scope === 'track' && normalize(fact.trackTitle ?? '') === normalizedTitle);
  const generalFacts = record.facts.filter((fact) => fact.scope !== 'track');
  if (trackFacts.length === 0 && generalFacts.length === 0) return null;

  const offset = generalFacts.length === 0
    ? 0
    : Number.parseInt(createHash('sha256').update(normalizedTitle).digest('hex').slice(0, 8), 16) % generalFacts.length;
  const rotatedGeneral = [...generalFacts.slice(offset), ...generalFacts.slice(0, offset)];
  const selected = [...trackFacts, ...rotatedGeneral].slice(0, factsCount);
  if (selected.length === 0) return null;
  const sourcesByUrl = new Map(record.sources.map((source) => [source.url, source]));
  return {
    facts: selected.map((fact) => fact.text),
    sources: selected.map((fact) => fact.sourceUrls.flatMap((url) => {
      const source = sourcesByUrl.get(url);
      return source ? [{ ...source }] : [];
    })),
  };
}

const ZERO_METRICS: Omit<FactsResearchMetrics, 'cache'> = {
  webSearches: 0,
  openPages: 0,
  durationMs: 0,
};

export class CodexFactsService {
  private readonly client: CodexResearchClient;
  private readonly cache: ResearchCache;
  private readonly now: () => number;
  private readonly maxQueuedResearch: number;
  private readonly inFlight = new Map<string, Promise<ResearchJobResult>>();
  private readonly queue: QueueItem[] = [];
  private active: QueueItem | null = null;
  private epoch = 0;
  private accountKey: string | null = null;
  private disposed = false;

  constructor(options: CodexFactsServiceOptions) {
    this.client = options.client;
    this.now = options.now ?? Date.now;
    this.maxQueuedResearch = options.maxQueuedResearch ?? MAX_QUEUED_RESEARCH;
    this.cache = new ResearchCache({ cachePath: options.cachePath, now: this.now });
  }

  async generate(
    metadata: FactsRequest,
    config: FactsConfig,
    options: { force?: boolean } = {},
  ): Promise<FactsResponse> {
    const preflightEpoch = this.epoch;
    const { accountKey, epoch: requestEpoch } = await this.beginAccountRequest(preflightEpoch);
    const trackKey = this.cache.makeTrackKey(accountKey, metadata, config);
    const albumKey = this.cache.makeResearchKey(accountKey, metadata, config, 'album');
    let albumRecord: CachedResearchRecord | null = null;
    if (!options.force) {
      const cachedTrack = this.cache.getTrack(trackKey);
      if (cachedTrack) {
        albumRecord = this.cache.getResearch(albumKey);
        if (!albumRecord || cachedTrack.researchRevision === researchRecordRevision(albumRecord)) {
          await this.assertCurrentAccount(accountKey, requestEpoch);
          return this.response(cachedTrack, true, { cache: 'track', ...ZERO_METRICS });
        }
      }
    }

    if (!options.force && !albumRecord) albumRecord = this.cache.getResearch(albumKey);
    let metrics: Omit<FactsResearchMetrics, 'cache'> | null = null;
    let performedResearch = false;
    if (!albumRecord) {
      const researched = await this.getOrQueueResearch(
        `${options.force ? 'force:' : ''}${albumKey}`,
        accountKey,
        metadata,
        config,
        'album',
        requestEpoch,
      );
      albumRecord = researched.record;
      metrics = metrics ? mergeMetrics(metrics, researched.metrics) : researched.metrics;
      performedResearch = true;
      await this.assertCurrentAccount(accountKey, requestEpoch);
      this.cache.setResearch(albumKey, albumRecord);
    }

    let selected = selectFacts(albumRecord, metadata.title, config.factsCount);
    if (!selected) {
      const focusedKey = this.cache.makeResearchKey(accountKey, metadata, config, 'track');
      let focusedRecord = options.force ? null : this.cache.getResearch(focusedKey);
      if (!focusedRecord) {
        const researched = await this.getOrQueueResearch(
          `${options.force ? 'force:' : ''}${focusedKey}`,
          accountKey,
          metadata,
          config,
          'track',
          requestEpoch,
        );
        focusedRecord = researched.record;
        metrics = metrics ? mergeMetrics(metrics, researched.metrics) : researched.metrics;
        performedResearch = true;
        await this.assertCurrentAccount(accountKey, requestEpoch);
        this.cache.setResearch(focusedKey, focusedRecord);
      }
      albumRecord = mergeRecords(albumRecord, focusedRecord);
      this.cache.setResearch(albumKey, albumRecord);
      selected = selectFacts(albumRecord, metadata.title, config.factsCount);
    }

    if (!selected) {
      throw new CodexResearchError('invalid-output');
    }
    await this.assertCurrentAccount(accountKey, requestEpoch);
    const trackResult: CachedTrackResearchResult = {
      ...selected,
      timestamp: this.now(),
      generatedAt: albumRecord.timestamp,
      researchRevision: researchRecordRevision(albumRecord),
    };
    this.cache.setTrack(trackKey, trackResult);
    return this.response(trackResult, !performedResearch, {
      cache: performedResearch ? 'miss' : 'album',
      ...(metrics ?? ZERO_METRICS),
    });
  }

  async invalidate(): Promise<void> {
    await this.startInvalidation().completion;
  }

  /** Stop owned work during shutdown without discarding reusable research. */
  async dispose(): Promise<void> {
    if (this.disposed) {
      await this.cache.flush();
      return;
    }
    this.disposed = true;
    await this.startCancellation().completion;
    await this.cache.flush();
  }

  private startCancellation(): { epoch: number; completion: Promise<void> } {
    this.epoch += 1;
    this.accountKey = null;
    const error = new CodexResearchError('canceled');
    for (const item of this.queue.splice(0)) this.rejectItem(item, error);
    if (this.active) {
      this.active.controller.abort();
      this.rejectItem(this.active, error);
    }
    return {
      epoch: this.epoch,
      completion: Promise.allSettled([this.client.cancelResearch()]).then(() => undefined),
    };
  }

  private startInvalidation(): { epoch: number; completion: Promise<void> } {
    const cancellation = this.startCancellation();
    return {
      epoch: cancellation.epoch,
      completion: cancellation.completion.then(() => this.cache.invalidate()),
    };
  }

  async flush(): Promise<void> {
    await this.cache.flush();
  }

  private response(
    result: CachedTrackResearchResult,
    cached: boolean,
    research: FactsResearchMetrics,
  ): FactsResponse {
    return {
      facts: [...result.facts],
      sources: result.sources.map((sources) => sources.map((source) => ({ ...source }))),
      cached,
      generatedAt: result.generatedAt,
      research,
    };
  }

  private async beginAccountRequest(preflightEpoch: number): Promise<{ accountKey: string; epoch: number }> {
    if (this.disposed) throw new CodexResearchError('unavailable');
    const accountKey = await this.client.getResearchAccountKey();
    if (this.disposed) throw new CodexResearchError('unavailable');
    if (preflightEpoch !== this.epoch) throw new CodexResearchError('canceled');
    let requestEpoch = preflightEpoch;
    if (this.accountKey !== null && this.accountKey !== accountKey) {
      const invalidation = this.startInvalidation();
      await invalidation.completion;
      if (this.disposed) throw new CodexResearchError('unavailable');
      if (this.epoch !== invalidation.epoch) throw new CodexResearchError('canceled');
      requestEpoch = invalidation.epoch;
    }
    this.accountKey = accountKey;
    return { accountKey, epoch: requestEpoch };
  }

  private async assertCurrentAccount(accountKey: string, epoch: number): Promise<void> {
    const current = await this.client.getResearchAccountKey();
    if (epoch !== this.epoch || current !== accountKey) {
      if (epoch === this.epoch) {
        await this.invalidate();
        this.accountKey = current;
      }
      throw new CodexResearchError('canceled');
    }
  }

  private getOrQueueResearch(
    inFlightKey: string,
    accountKey: string,
    metadata: FactsRequest,
    config: FactsConfig,
    focus: 'album' | 'track',
    epoch: number,
  ): Promise<ResearchJobResult> {
    const existing = this.inFlight.get(inFlightKey);
    if (existing) return existing;
    const promise = this.enqueue(epoch, async (signal) => validateResearchResult(await this.client.research({
      ...metadata,
      accountKey,
      model: config.model,
      prompt: config.prompt,
      factsCount: config.factsCount,
      focus,
      signal,
    }), this.now()));
    this.inFlight.set(inFlightKey, promise);
    void promise.finally(() => {
      if (this.inFlight.get(inFlightKey) === promise) this.inFlight.delete(inFlightKey);
    }).catch(() => undefined);
    return promise;
  }

  private enqueue(epoch: number, run: QueueItem['run']): Promise<ResearchJobResult> {
    if (this.disposed) return Promise.reject(new CodexResearchError('unavailable'));
    if (epoch !== this.epoch) return Promise.reject(new CodexResearchError('canceled'));
    if (this.active && this.queue.length >= this.maxQueuedResearch) {
      return Promise.reject(new CodexResearchError('busy'));
    }
    return new Promise<ResearchJobResult>((resolve, reject) => {
      this.queue.push({
        epoch,
        controller: new AbortController(),
        run,
        resolve,
        reject,
        settled: false,
      });
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    if (this.active) return;
    const item = this.queue.shift();
    if (!item) return;
    if (item.epoch !== this.epoch) {
      this.rejectItem(item, new CodexResearchError('canceled'));
      this.drainQueue();
      return;
    }
    this.active = item;
    void item.run(item.controller.signal)
      .then((result) => this.resolveItem(item, result), (error: unknown) => this.rejectItem(item, error))
      .finally(() => {
        if (this.active === item) this.active = null;
        this.drainQueue();
      });
  }

  private resolveItem(item: QueueItem, result: ResearchJobResult): void {
    if (item.settled) return;
    item.settled = true;
    item.resolve(result);
  }

  private rejectItem(item: QueueItem, error: unknown): void {
    if (item.settled) return;
    item.settled = true;
    item.reject(error);
  }
}
