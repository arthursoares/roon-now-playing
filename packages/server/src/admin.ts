import { Router } from 'express';
import type { WebSocketManager } from './websocket.js';
import type { LayoutType, FontType, BackgroundType } from '@roon-screen-cover/shared';
import { LAYOUTS, FONTS, BACKGROUNDS } from '@roon-screen-cover/shared';
import { logger } from './logger.js';
import { loadDisplaySettings, saveDisplaySettings } from './display-settings.js';

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

    if (name && name.length > 50) {
      res.status(400).json({ error: 'Name must be 50 characters or fewer' });
      return;
    }

    // Check uniqueness — another screen shouldn't already have this name
    if (name) {
      const existing = wsManager.getClientByFriendlyName(name);
      if (existing && existing.clientId !== clientId) {
        res.status(409).json({ error: 'Name already in use by another screen' });
        return;
      }
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
    const { layout, font, background, zoneId, fontScaleOverride, artworkScaleOverride, enabledLayouts } = req.body as {
      layout?: LayoutType;
      font?: FontType;
      background?: BackgroundType;
      zoneId?: string;
      fontScaleOverride?: number | null;
      artworkScaleOverride?: number | null;
      enabledLayouts?: LayoutType[] | null;
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

    // Validate fontScaleOverride
    if (fontScaleOverride !== undefined && fontScaleOverride !== null) {
      if (typeof fontScaleOverride !== 'number' || fontScaleOverride < 0.75 || fontScaleOverride > 1.5) {
        res.status(400).json({ error: 'fontScaleOverride must be a number between 0.75 and 1.5, or null' });
        return;
      }
    }

    // Validate artworkScaleOverride
    if (artworkScaleOverride !== undefined && artworkScaleOverride !== null) {
      if (typeof artworkScaleOverride !== 'number' || artworkScaleOverride < 50 || artworkScaleOverride > 100) {
        res.status(400).json({ error: 'artworkScaleOverride must be a number between 50 and 100, or null' });
        return;
      }
    }

    // Validate enabledLayouts
    if (enabledLayouts !== undefined && enabledLayouts !== null) {
      if (!Array.isArray(enabledLayouts) || enabledLayouts.length === 0) {
        res.status(400).json({ error: 'enabledLayouts must be a non-empty array of layout types, or null' });
        return;
      }
      for (const l of enabledLayouts) {
        if (!(LAYOUTS as readonly string[]).includes(l)) {
          res.status(400).json({ error: `Invalid layout in enabledLayouts: ${l}. Must be one of: ${LAYOUTS.join(', ')}` });
          return;
        }
      }
    }

    // Check if any settings provided
    if (layout === undefined && font === undefined && background === undefined && zoneId === undefined && fontScaleOverride === undefined && artworkScaleOverride === undefined && enabledLayouts === undefined) {
      res.status(400).json({ error: 'At least one setting is required' });
      return;
    }

    const success = wsManager.pushSettingsToClient(clientId, { layout, font, background, zoneId, fontScaleOverride, artworkScaleOverride, enabledLayouts });
    if (success) {
      logger.info(
        `Pushed settings to ${clientId}: layout=${layout}, font=${font}, background=${background}, zoneId=${zoneId}, fontScaleOverride=${fontScaleOverride}, artworkScaleOverride=${artworkScaleOverride}, enabledLayouts=${enabledLayouts}`
      );
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Client not found or not connected' });
    }
  });

  // Get screen by friendly name
  router.get('/screens/:friendlyName', (req, res) => {
    const { friendlyName } = req.params;
    const client = wsManager.getClientByFriendlyName(friendlyName);
    if (client) {
      res.json({ client });
    } else {
      res.status(404).json({ error: 'Screen not found' });
    }
  });

  // Get display settings
  router.get('/display-settings', (_req, res) => {
    const settings = loadDisplaySettings();
    res.json(settings);
  });

  // Update display settings
  router.post('/display-settings', (req, res) => {
    const { fontScale, artworkScale } = req.body;
    const settings = loadDisplaySettings();

    if (typeof fontScale === 'number' && fontScale >= 0.75 && fontScale <= 1.5) {
      settings.fontScale = fontScale;
    }

    if (typeof artworkScale === 'number' && artworkScale >= 50 && artworkScale <= 100) {
      settings.artworkScale = artworkScale;
    }

    saveDisplaySettings(settings);
    wsManager.broadcastDisplaySettings(settings);
    res.json(settings);
  });

  return router;
}
