import { Router } from 'express';
import type { WebSocketManager } from './websocket.js';
import type { LayoutType, FontType, BackgroundType } from '@roon-screen-cover/shared';
import { LAYOUTS, FONTS, BACKGROUNDS } from '@roon-screen-cover/shared';
import { logger } from './logger.js';

export function createAdminRouter(wsManager: WebSocketManager): Router {
  const router = Router();

  // Get all connected clients
  router.get('/clients', (_req, res) => {
    const clients = wsManager.getAllClientsMetadata();
    res.json({ clients });
  });

  // Get available zones
  router.get('/zones', (_req, res) => {
    const zones = wsManager.getZones();
    res.json({ zones });
  });

  // Set client friendly name
  router.post('/clients/:clientId/name', (req, res) => {
    const { clientId } = req.params;
    const { name } = req.body as { name?: string };

    if (name !== undefined && name !== null && typeof name !== 'string') {
      res.status(400).json({ error: 'Name must be a string or null' });
      return;
    }

    const success = wsManager.setClientFriendlyName(clientId, name || null);
    if (success) {
      logger.info(`Set friendly name for ${clientId}: ${name || '(cleared)'}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Client not found' });
    }
  });

  // Push settings to client
  router.post('/clients/:clientId/push', (req, res) => {
    const { clientId } = req.params;
    const { layout, font, background, zoneId } = req.body as {
      layout?: LayoutType;
      font?: FontType;
      background?: BackgroundType;
      zoneId?: string;
    };

    // Validate layout
    if (layout !== undefined && !(LAYOUTS as readonly string[]).includes(layout)) {
      res.status(400).json({ error: `Invalid layout. Must be one of: ${LAYOUTS.join(', ')}` });
      return;
    }

    // Validate font
    if (font !== undefined && !(FONTS as readonly string[]).includes(font)) {
      res.status(400).json({ error: `Invalid font. Must be one of: ${FONTS.join(', ')}` });
      return;
    }

    // Validate background
    if (background !== undefined && !(BACKGROUNDS as readonly string[]).includes(background)) {
      res.status(400).json({ error: `Invalid background. Must be one of: ${BACKGROUNDS.join(', ')}` });
      return;
    }

    // Check if any settings provided
    if (layout === undefined && font === undefined && background === undefined && zoneId === undefined) {
      res.status(400).json({ error: 'At least one setting (layout, font, background, or zoneId) is required' });
      return;
    }

    const success = wsManager.pushSettingsToClient(clientId, { layout, font, background, zoneId });
    if (success) {
      logger.info(
        `Pushed settings to ${clientId}: layout=${layout}, font=${font}, background=${background}, zoneId=${zoneId}`
      );
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Client not found or not connected' });
    }
  });

  return router;
}
