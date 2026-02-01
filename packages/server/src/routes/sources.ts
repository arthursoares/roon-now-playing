import { Router, type Request, type Response } from 'express';
import type { ExternalUpdatePayload } from '@roon-screen-cover/shared';
import { ExternalSourceManager } from '../externalSources.js';
import { SourcesConfigStore } from '../sourcesConfig.js';
import { logger } from '../logger.js';

export function createSourcesRouter(
  externalSourceManager: ExternalSourceManager,
  sourcesConfigStore: SourcesConfigStore
): Router {
  const router = Router();

  // Authentication middleware
  const authenticate = (req: Request, res: Response, next: () => void) => {
    if (!sourcesConfigStore.isAuthRequired()) {
      next();
      return;
    }

    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey || !sourcesConfigStore.validateApiKey(apiKey)) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API key' });
      return;
    }
    next();
  };

  // POST /api/sources/:zoneId/now-playing - Push now-playing update
  router.post('/:zoneId/now-playing', authenticate, async (req: Request, res: Response) => {
    const zoneId = req.params.zoneId as string;
    const payload = req.body as ExternalUpdatePayload;

    // Validate required fields
    if (!payload.zone_name || typeof payload.zone_name !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'zone_name is required' });
      return;
    }

    if (!payload.state || !['playing', 'paused', 'stopped'].includes(payload.state)) {
      res.status(400).json({ error: 'Bad Request', message: 'state must be playing, paused, or stopped' });
      return;
    }

    // Validate title/artist when playing or paused
    if (payload.state !== 'stopped') {
      if (!payload.title || typeof payload.title !== 'string') {
        res.status(400).json({ error: 'Bad Request', message: 'title is required when playing' });
        return;
      }
      if (!payload.artist || typeof payload.artist !== 'string') {
        res.status(400).json({ error: 'Bad Request', message: 'artist is required when playing' });
        return;
      }
    }

    try {
      const result = await externalSourceManager.updateZone(zoneId, payload);
      res.json(result);
    } catch (error) {
      logger.error(`Failed to update external zone: ${error}`);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // DELETE /api/sources/:zoneId - Remove zone
  router.delete('/:zoneId', authenticate, (req: Request, res: Response) => {
    const zoneId = req.params.zoneId as string;
    const deleted = externalSourceManager.deleteZone(zoneId);

    if (!deleted) {
      res.status(404).json({ error: 'Not Found', message: 'Zone not found' });
      return;
    }

    res.json({ success: true });
  });

  // GET /api/sources - List all external zones
  router.get('/', (req: Request, res: Response) => {
    const zones = externalSourceManager.getExternalZones();
    res.json({ zones });
  });

  // GET /api/sources/config - Get sources config (for admin)
  router.get('/config', (req: Request, res: Response) => {
    const config = sourcesConfigStore.get();
    res.json({
      requireApiKey: config.requireApiKey,
      hasApiKey: !!config.apiKey,
      // Mask the API key for display
      apiKey: config.apiKey ? config.apiKey.slice(0, 8) + '...' : null,
    });
  });

  // POST /api/sources/config - Update sources config (for admin)
  router.post('/config', (req: Request, res: Response) => {
    const { requireApiKey } = req.body;

    if (typeof requireApiKey === 'boolean') {
      sourcesConfigStore.update({ requireApiKey });
    }

    res.json({ success: true });
  });

  // POST /api/sources/config/generate-key - Generate new API key
  router.post('/config/generate-key', (req: Request, res: Response) => {
    const key = sourcesConfigStore.generateApiKey();
    res.json({ success: true, apiKey: key });
  });

  return router;
}
