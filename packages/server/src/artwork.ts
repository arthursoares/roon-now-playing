import { Router, type Request, type Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { RoonClient } from './roon.js';
import { logger } from './logger.js';

const CACHE_DIR = process.env.ARTWORK_CACHE_DIR || './cache';

export function createArtworkRouter(roonClient: RoonClient): Router {
  const router = Router();

  // Ensure cache directory exists
  ensureCacheDir().catch((err) => {
    logger.error(`Failed to create cache directory: ${err}`);
  });

  router.get('/artwork/:key', async (req: Request, res: Response) => {
    const keyParam = req.params.key;
    const key = Array.isArray(keyParam) ? keyParam[0] : keyParam;

    if (!key || key.length < 1) {
      res.status(400).send('Invalid artwork key');
      return;
    }

    try {
      // Try to serve from cache first
      const cachedPath = getCachePath(key);

      try {
        const cached = await fs.readFile(cachedPath);
        logger.debug(`Serving cached artwork: ${key}`);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
        res.send(cached);
        return;
      } catch {
        // Not in cache, fetch from Roon
      }

      // Fetch from Roon
      logger.debug(`Fetching artwork from Roon: ${key}`);
      const artwork = await roonClient.getArtwork(key);

      if (!artwork) {
        res.status(404).send('Artwork not found');
        return;
      }

      // Cache the artwork
      await cacheArtwork(key, artwork);

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(artwork);
    } catch (error) {
      logger.error(`Error serving artwork: ${error}`);
      res.status(500).send('Internal server error');
    }
  });

  return router;
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function getCachePath(key: string): string {
  // Sanitize the key to prevent path traversal
  const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(CACHE_DIR, `${sanitizedKey}.jpg`);
}

export async function cacheArtwork(key: string, data: Buffer): Promise<void> {
  try {
    await ensureCacheDir();
    const cachePath = getCachePath(key);
    await fs.writeFile(cachePath, data);
    logger.debug(`Cached artwork: ${key}`);
  } catch (error) {
    logger.warn(`Failed to cache artwork: ${error}`);
  }
}

export async function cacheExternalArtwork(url: string): Promise<string | null> {
  try {
    // Generate a key from the URL
    const key = createHash('md5').update(url).digest('hex');
    const cachePath = getCachePath(key);

    // Check if already cached
    try {
      await fs.access(cachePath);
      logger.debug(`External artwork already cached: ${key}`);
      return key;
    } catch {
      // Not cached, continue to fetch
    }

    // Fetch the image
    logger.debug(`Fetching external artwork: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      logger.warn(`Failed to fetch external artwork: ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Cache it
    await cacheArtwork(key, buffer);
    return key;
  } catch (error) {
    logger.error(`Error caching external artwork: ${error}`);
    return null;
  }
}

export async function cacheBase64Artwork(base64: string): Promise<string | null> {
  try {
    // Generate a key from the content
    const key = createHash('md5').update(base64).digest('hex');
    const cachePath = getCachePath(key);

    // Check if already cached
    try {
      await fs.access(cachePath);
      logger.debug(`Base64 artwork already cached: ${key}`);
      return key;
    } catch {
      // Not cached, continue
    }

    // Decode and cache
    const buffer = Buffer.from(base64, 'base64');
    await cacheArtwork(key, buffer);
    return key;
  } catch (error) {
    logger.error(`Error caching base64 artwork: ${error}`);
    return null;
  }
}
