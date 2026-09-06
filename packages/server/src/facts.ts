import { Router, type Response } from 'express';
import { createHash } from 'node:crypto';
import type { FactsConfig, FactsResponse, FactsTestResponse } from '@roon-screen-cover/shared';
import { FactsConfigStore, validateFactsConfigUpdate } from './factsConfig.js';
import { FactsCache } from './factsCache.js';
import { createLLMProvider } from './llm.js';
import { logger } from './logger.js';
import { OutputLimitError } from './llmErrors.js';
import type { CodexFactsService } from './codexFacts.js';
import { CodexResearchError } from './codexResearchTypes.js';
import { requireCodexSameOrigin } from './routes/codex.js';

const MAX_METADATA_LENGTH = 500;

interface ValidatedMetadata {
  artist: string;
  album: string;
  title: string;
}

interface GeneratedFacts {
  facts: string[];
  generatedAt: number;
}

function makeInFlightKey(cacheKey: string, config: FactsConfig): string {
  const authFingerprint = createHash('sha256').update(config.apiKey).digest('hex');
  return `${cacheKey}:${authFingerprint}`;
}

function validateMetadata(input: unknown): ValidatedMetadata | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const fields = [body.artist, body.album, body.title];
  if (fields.some((field) => typeof field !== 'string'
    || field.trim().length === 0
    || field.length > MAX_METADATA_LENGTH)) return null;
  return {
    artist: (body.artist as string).trim(),
    album: (body.album as string).trim(),
    title: (body.title as string).trim(),
  };
}

function sendGenerationError(res: Response, error: unknown, context: string): void {
  if (error instanceof CodexResearchError) {
    const status = error.code === 'timeout' ? 504
      : ['not-connected', 'unavailable', 'busy', 'model-unavailable', 'canceled'].includes(error.code) ? 503 : 502;
    res.status(status).json({ error: { type: 'api-error', message: error.message } });
    return;
  }
  if (error instanceof OutputLimitError) {
    logger.warn(`${context} reached the configured output limit`);
    res.status(502).json({ error: { type: 'api-error', message: error.message } });
    return;
  }
  logger.error(`${context} failed`);
  res.status(500).json({
    error: { type: 'api-error', message: 'Failed to generate facts. Please try again.' },
  });
}

export function createFactsRouter(options: {
  codexFacts?: Pick<CodexFactsService, 'generate' | 'invalidate'>;
} = {}): Router {
  const router = Router();
  const configStore = new FactsConfigStore();
  const cache = new FactsCache();
  const inFlight = new Map<string, Promise<GeneratedFacts>>();

  router.post('/facts', async (req, res) => {
    const metadata = validateMetadata(req.body);
    if (!metadata) {
      res.status(400).json({
        error: `artist, album, and title must be non-empty strings no longer than ${MAX_METADATA_LENGTH} characters`,
      });
      return;
    }

    const config: FactsConfig = { ...configStore.get() };
    if (config.provider === 'codex') {
      try {
        if (!options.codexFacts) throw new CodexResearchError('unavailable');
        // The research service checks account identity before any cache hit.
        res.set('Cache-Control', 'no-store');
        res.json(await options.codexFacts.generate(metadata, config));
      } catch (error) {
        sendGenerationError(res, error, 'ChatGPT research');
      }
      return;
    }
    const cached = cache.getEntry(metadata.artist, metadata.album, metadata.title, config);
    if (cached) {
      const response: FactsResponse = {
        facts: cached.facts,
        cached: true,
        generatedAt: cached.timestamp,
      };
      res.json(response);
      return;
    }

    if (!config.apiKey && config.provider !== 'local') {
      res.status(503).json({ error: { type: 'no-key', message: 'No API key configured' } });
      return;
    }

    const cacheKey = cache.makeKey(metadata.artist, metadata.album, metadata.title, config);
    const key = makeInFlightKey(cacheKey, config);
    let generation = inFlight.get(key);
    if (!generation) {
      generation = Promise.resolve().then(async () => {
        const provider = createLLMProvider(config);
        const facts = await provider.generateFacts(metadata.artist, metadata.album, metadata.title);
        if (facts.length === 0) return { facts, generatedAt: Date.now() };
        const generatedAt = Date.now();
        cache.set(metadata.artist, metadata.album, metadata.title, facts, config, generatedAt);
        return { facts, generatedAt };
      });
      inFlight.set(key, generation);
      void generation.finally(() => {
        if (inFlight.get(key) === generation) inFlight.delete(key);
      }).catch(() => undefined);
    }

    try {
      const generated = await generation;
      if (generated.facts.length === 0) {
        res.status(502).json({
          error: { type: 'empty', message: 'No usable facts could be generated. Please try again.' },
        });
        return;
      }
      const response: FactsResponse = {
        facts: generated.facts,
        cached: false,
        generatedAt: generated.generatedAt,
      };
      res.json(response);
    } catch (error) {
      sendGenerationError(res, error, 'Facts generation');
    }
  });

  router.get('/facts/config', (_req, res) => {
    const config = configStore.get();
    res.json({
      ...config,
      apiKey: config.apiKey ? `••••••••${config.apiKey.slice(-4)}` : '',
      hasApiKey: !!config.apiKey,
    });
  });

  router.post('/facts/config', async (req, res) => {
    const validation = validateFactsConfigUpdate(req.body);
    if ('error' in validation) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const updates = { ...validation.value };
    const previous = configStore.get();
    if (updates.provider === 'codex' && !options.codexFacts) {
      res.status(503).json({ error: 'ChatGPT research is not enabled on this server.' });
      return;
    }
    if ((previous.provider === 'codex' || updates.provider === 'codex')
      && !requireCodexSameOrigin(req, res)) return;
    if (updates.apiKey?.includes('••••')) delete updates.apiKey;
    try {
      configStore.update(updates);
      const changed = (['provider', 'model', 'prompt', 'factsCount'] as const)
        .some(key => updates[key] !== undefined && updates[key] !== previous[key]);
      if (previous.provider === 'codex' && changed) await options.codexFacts?.invalidate();
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid facts config update' });
      return;
    }
    logger.info('Facts config updated');
    res.json({ success: true });
  });

  router.post('/facts/test', async (req, res) => {
    const metadata = validateMetadata(req.body);
    if (!metadata) {
      res.status(400).json({
        error: `artist, album, and title must be non-empty strings no longer than ${MAX_METADATA_LENGTH} characters`,
      });
      return;
    }

    const config = { ...configStore.get() };
    if (config.provider === 'codex') {
      if (!requireCodexSameOrigin(req, res)) return;
      const startedAt = Date.now();
      try {
        if (!options.codexFacts) throw new CodexResearchError('unavailable');
        const result = await options.codexFacts.generate(metadata, config, { force: true });
        res.set('Cache-Control', 'no-store');
        res.json({ ...result, durationMs: Date.now() - startedAt } satisfies FactsTestResponse);
      } catch (error) {
        sendGenerationError(res, error, 'ChatGPT research test');
      }
      return;
    }
    if (!config.apiKey && config.provider !== 'local') {
      res.status(400).json({ error: 'No API key configured' });
      return;
    }

    const startTime = Date.now();
    try {
      const provider = createLLMProvider(config);
      const facts = await provider.generateFacts(metadata.artist, metadata.album, metadata.title);
      const durationMs = Date.now() - startTime;
      if (facts.length === 0) {
        res.status(502).json({
          error: { type: 'empty', message: 'No usable facts could be generated. Please try again.' },
        });
        return;
      }
      const response: FactsTestResponse = { facts, durationMs };
      res.json(response);
    } catch (error) {
      sendGenerationError(res, error, 'Facts test');
    }
  });

  return router;
}
