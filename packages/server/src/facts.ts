import { Router } from 'express';
import type { FactsConfig, FactsRequest, FactsResponse, FactsTestResponse } from '@roon-screen-cover/shared';
import { FactsConfigStore, isValidMaxOutputTokens } from './factsConfig.js';
import { FactsCache } from './factsCache.js';
import { createLLMProvider } from './llm.js';
import { logger } from './logger.js';
import { OutputLimitError } from './llmErrors.js';

export function createFactsRouter(): Router {
  const router = Router();
  const configStore = new FactsConfigStore();
  const cache = new FactsCache();

  // Get facts for a track
  router.post('/facts', async (req, res) => {
    const { artist, album, title } = req.body as FactsRequest;

    if (!artist || !album || !title) {
      res.status(400).json({ error: 'artist, album, and title are required' });
      return;
    }

    const config = configStore.get();

    if (!config.apiKey && config.provider !== 'local') {
      res.status(503).json({
        error: { type: 'no-key', message: 'No API key configured' },
      });
      return;
    }

    // Check cache first
    const cached = cache.get(artist, album, title);
    if (cached) {
      const timestamp = cache.getTimestamp(artist, album, title);
      const response: FactsResponse = {
        facts: cached,
        cached: true,
        generatedAt: timestamp || Date.now(),
      };
      res.json(response);
      return;
    }

    // Generate new facts
    try {
      const provider = createLLMProvider(config);
      const facts = await provider.generateFacts(artist, album, title);

      if (facts.length === 0) {
        res.status(502).json({
          error: { type: 'empty', message: 'No usable facts could be generated. Please try again.' },
        });
        return;
      }

      // Cache the result
      cache.set(artist, album, title, facts);

      const response: FactsResponse = {
        facts,
        cached: false,
        generatedAt: Date.now(),
      };
      res.json(response);
    } catch (error) {
      if (error instanceof OutputLimitError) {
        logger.warn('Facts generation reached the configured output limit');
        res.status(502).json({
          error: { type: 'api-error', message: error.message },
        });
        return;
      }
      logger.error('Facts generation failed');
      res.status(500).json({
        error: { type: 'api-error', message: 'Failed to generate facts. Please try again.' },
      });
    }
  });

  // Get facts configuration
  router.get('/facts/config', (_req, res) => {
    const config = configStore.get();
    // Don't expose full API key
    res.json({
      ...config,
      apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : '',
      hasApiKey: !!config.apiKey,
    });
  });

  // Update facts configuration
  router.post('/facts/config', (req, res) => {
    const updates = req.body as Partial<FactsConfig>;

    if (updates.maxOutputTokens !== undefined && !isValidMaxOutputTokens(updates.maxOutputTokens)) {
      res.status(400).json({
        error: 'maxOutputTokens must be an integer between 1 and 65536',
      });
      return;
    }

    // Don't save masked API key (contains bullet points from UI display)
    if (updates.apiKey && updates.apiKey.includes('••••')) {
      delete updates.apiKey;
    }

    configStore.update(updates);
    logger.info('Facts config updated');
    res.json({ success: true });
  });

  // Test facts generation
  router.post('/facts/test', async (req, res) => {
    const { artist, album, title } = req.body as FactsRequest;

    if (!artist || !album || !title) {
      res.status(400).json({ error: 'artist, album, and title are required' });
      return;
    }

    const config = configStore.get();

    // API key is required for cloud providers, but optional for local LLM
    if (!config.apiKey && config.provider !== 'local') {
      res.status(400).json({ error: 'No API key configured' });
      return;
    }

    const startTime = Date.now();

    try {
      const provider = createLLMProvider(config);
      const facts = await provider.generateFacts(artist, album, title);
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
      if (error instanceof OutputLimitError) {
        logger.warn('Facts test reached the configured output limit');
        res.status(502).json({
          error: { type: 'api-error', message: error.message },
        });
        return;
      }
      logger.error('Facts test failed');
      res.status(500).json({
        error: { type: 'api-error', message: 'Failed to generate facts. Please try again.' },
      });
    }
  });

  return router;
}
