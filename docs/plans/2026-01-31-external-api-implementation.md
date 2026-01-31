# External Sources API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a REST API that allows external music sources to push now-playing data, appearing as zones alongside Roon.

**Architecture:** External sources push updates via `POST /api/sources/:zoneId/now-playing`. The `ExternalSourceManager` class manages zone state, persists zones to disk, and emits events consumed by `WebSocketManager`. Zones auto-transition to "disconnected" after 60s of inactivity.

**Tech Stack:** Express.js, TypeScript, EventEmitter pattern (matching existing RoonClient)

---

## Task 1: Add Shared Types

**Files:**
- Modify: `packages/shared/src/index.ts`

**Step 1: Add external source types to shared package**

Add these types at the end of the file, before the `ServerMessage` union type:

```typescript
// External source types
export type SourceType = 'roon' | 'external';
export type SourceStatus = 'connected' | 'disconnected';

export interface ExternalZone {
  zone_id: string;
  zone_name: string;
  state: PlaybackState;
  track: Track | null;
  seek_position: number;
  source_status: SourceStatus;
  last_seen: string; // ISO date string
}

export interface ExternalUpdatePayload {
  zone_name: string;
  state: PlaybackState;
  title?: string;
  artist?: string;
  album?: string;
  duration_seconds?: number;
  seek_position?: number;
  artwork_url?: string;
  artwork_base64?: string;
}

export interface ExternalUpdateResponse {
  success: boolean;
  zone_id: string;
  artwork_key?: string;
}

export interface SourcesConfig {
  requireApiKey: boolean;
  apiKey: string;
}

export interface ZoneWithSource extends Zone {
  source: SourceType;
}
```

**Step 2: Run typecheck to verify changes**

Run: `pnpm run build:shared && pnpm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add external source types"
```

---

## Task 2: Create Sources Config Store

**Files:**
- Create: `packages/server/src/sourcesConfig.ts`
- Create: `packages/server/src/sourcesConfig.spec.ts`

**Step 1: Write the failing test**

Create `packages/server/src/sourcesConfig.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { SourcesConfigStore } from './sourcesConfig.js';

const TEST_CONFIG_PATH = './test-sources-config.json';

describe('SourcesConfigStore', () => {
  afterEach(async () => {
    try {
      await fs.unlink(TEST_CONFIG_PATH);
    } catch {
      // File may not exist
    }
  });

  it('should return default config when no file exists', () => {
    const store = new SourcesConfigStore(TEST_CONFIG_PATH);
    const config = store.get();
    expect(config.requireApiKey).toBe(false);
    expect(config.apiKey).toBe('');
  });

  it('should generate a new API key', () => {
    const store = new SourcesConfigStore(TEST_CONFIG_PATH);
    const key = store.generateApiKey();
    expect(key).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    expect(store.get().apiKey).toBe(key);
  });

  it('should validate correct API key', () => {
    const store = new SourcesConfigStore(TEST_CONFIG_PATH);
    const key = store.generateApiKey();
    expect(store.validateApiKey(key)).toBe(true);
    expect(store.validateApiKey('wrong-key')).toBe(false);
  });

  it('should persist config to file', async () => {
    const store = new SourcesConfigStore(TEST_CONFIG_PATH);
    store.update({ requireApiKey: true });
    store.generateApiKey();

    // Create new instance to verify persistence
    const store2 = new SourcesConfigStore(TEST_CONFIG_PATH);
    expect(store2.get().requireApiKey).toBe(true);
    expect(store2.get().apiKey).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/server/src/sourcesConfig.spec.ts`
Expected: FAIL with "Cannot find module './sourcesConfig.js'"

**Step 3: Write minimal implementation**

Create `packages/server/src/sourcesConfig.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { SourcesConfig } from '@roon-screen-cover/shared';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_CONFIG_PATH = path.join(DATA_DIR, 'sources-config.json');

const DEFAULT_CONFIG: SourcesConfig = {
  requireApiKey: false,
  apiKey: '',
};

export class SourcesConfigStore {
  private config: SourcesConfig;
  private configPath: string;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath;
    this.config = { ...DEFAULT_CONFIG };
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data) as Partial<SourcesConfig>;
        this.config = { ...DEFAULT_CONFIG, ...parsed };
        logger.info(`Loaded sources config from ${this.configPath}`);
      }
    } catch (error) {
      logger.error(`Failed to load sources config: ${error}`);
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error(`Failed to save sources config: ${error}`);
    }
  }

  get(): SourcesConfig {
    return { ...this.config };
  }

  update(partial: Partial<SourcesConfig>): void {
    this.config = { ...this.config, ...partial };
    this.save();
  }

  generateApiKey(): string {
    const key = randomUUID();
    this.config.apiKey = key;
    this.save();
    return key;
  }

  validateApiKey(key: string): boolean {
    if (!this.config.apiKey) return false;
    return key === this.config.apiKey;
  }

  isAuthRequired(): boolean {
    return this.config.requireApiKey;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- packages/server/src/sourcesConfig.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/sourcesConfig.ts packages/server/src/sourcesConfig.spec.ts
git commit -m "feat(server): add sources config store"
```

---

## Task 3: Create External Source Manager

**Files:**
- Create: `packages/server/src/externalSources.ts`
- Create: `packages/server/src/externalSources.spec.ts`

**Step 1: Write the failing test**

Create `packages/server/src/externalSources.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { ExternalSourceManager } from './externalSources.js';

const TEST_ZONES_PATH = './test-external-zones.json';

describe('ExternalSourceManager', () => {
  let manager: ExternalSourceManager;

  beforeEach(() => {
    manager = new ExternalSourceManager(TEST_ZONES_PATH);
  });

  afterEach(async () => {
    manager.stopTimeoutChecker();
    try {
      await fs.unlink(TEST_ZONES_PATH);
    } catch {
      // File may not exist
    }
  });

  describe('updateZone', () => {
    it('should create a new zone on first update', () => {
      const result = manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
      });

      expect(result.success).toBe(true);
      expect(result.zone_id).toBe('spotify-office');

      const zones = manager.getZones();
      expect(zones).toHaveLength(1);
      expect(zones[0].id).toBe('spotify-office');
      expect(zones[0].display_name).toBe('Office Spotify');
    });

    it('should emit zones event on new zone', () => {
      const zonesHandler = vi.fn();
      manager.on('zones', zonesHandler);

      manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
      });

      expect(zonesHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit now_playing event on update', () => {
      const nowPlayingHandler = vi.fn();
      manager.on('now_playing', nowPlayingHandler);

      manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        duration_seconds: 180,
        seek_position: 45,
      });

      expect(nowPlayingHandler).toHaveBeenCalledWith({
        zone_id: 'spotify-office',
        state: 'playing',
        track: {
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          duration_seconds: 180,
          artwork_key: null,
        },
        seek_position: 45,
      });
    });

    it('should update existing zone without emitting zones event', () => {
      manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Song 1',
        artist: 'Artist 1',
      });

      const zonesHandler = vi.fn();
      manager.on('zones', zonesHandler);

      manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Song 2',
        artist: 'Artist 2',
      });

      expect(zonesHandler).not.toHaveBeenCalled();
    });
  });

  describe('deleteZone', () => {
    it('should remove zone and emit zones event', () => {
      manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'stopped',
      });

      const zonesHandler = vi.fn();
      manager.on('zones', zonesHandler);

      const result = manager.deleteZone('spotify-office');
      expect(result).toBe(true);
      expect(manager.getZones()).toHaveLength(0);
      expect(zonesHandler).toHaveBeenCalledWith([]);
    });

    it('should return false for non-existent zone', () => {
      const result = manager.deleteZone('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getNowPlaying', () => {
    it('should return null for non-existent zone', () => {
      expect(manager.getNowPlaying('non-existent')).toBeNull();
    });

    it('should return now playing for existing zone', () => {
      manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
      });

      const nowPlaying = manager.getNowPlaying('spotify-office');
      expect(nowPlaying).not.toBeNull();
      expect(nowPlaying?.zone_id).toBe('spotify-office');
      expect(nowPlaying?.track?.title).toBe('Test Song');
    });
  });

  describe('getExternalZones', () => {
    it('should return all external zones with metadata', () => {
      manager.updateZone('spotify-office', {
        zone_name: 'Office Spotify',
        state: 'playing',
        title: 'Test Song',
        artist: 'Test Artist',
      });

      const zones = manager.getExternalZones();
      expect(zones).toHaveLength(1);
      expect(zones[0].zone_id).toBe('spotify-office');
      expect(zones[0].source_status).toBe('connected');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/server/src/externalSources.spec.ts`
Expected: FAIL with "Cannot find module './externalSources.js'"

**Step 3: Write minimal implementation**

Create `packages/server/src/externalSources.ts`:

```typescript
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import type {
  Zone,
  NowPlaying,
  Track,
  PlaybackState,
  ExternalZone,
  ExternalUpdatePayload,
  ExternalUpdateResponse,
} from '@roon-screen-cover/shared';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_ZONES_PATH = path.join(DATA_DIR, 'external-zones.json');
const TIMEOUT_CHECK_INTERVAL = 30000; // 30 seconds
const DISCONNECT_TIMEOUT = 60000; // 60 seconds

interface StoredZone {
  zone_name: string;
  created_at: string;
  last_seen: string;
}

export interface ExternalSourceEvents {
  zones: (zones: Zone[]) => void;
  now_playing: (nowPlaying: NowPlaying) => void;
  seek: (zoneId: string, position: number) => void;
}

export class ExternalSourceManager extends EventEmitter {
  private zones: Map<string, ExternalZone> = new Map();
  private zonesPath: string;
  private timeoutChecker: NodeJS.Timeout | null = null;
  private artworkCallback?: (url: string) => Promise<string | null>;

  constructor(zonesPath: string = DEFAULT_ZONES_PATH) {
    super();
    this.zonesPath = zonesPath;
    this.load();
    this.startTimeoutChecker();
  }

  setArtworkCallback(callback: (url: string) => Promise<string | null>): void {
    this.artworkCallback = callback;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.zonesPath)) {
        const data = fs.readFileSync(this.zonesPath, 'utf-8');
        const stored = JSON.parse(data) as Record<string, StoredZone>;

        for (const [zoneId, storedZone] of Object.entries(stored)) {
          this.zones.set(zoneId, {
            zone_id: zoneId,
            zone_name: storedZone.zone_name,
            state: 'stopped',
            track: null,
            seek_position: 0,
            source_status: 'disconnected',
            last_seen: storedZone.last_seen,
          });
        }
        logger.info(`Loaded ${this.zones.size} external zones from ${this.zonesPath}`);
      }
    } catch (error) {
      logger.error(`Failed to load external zones: ${error}`);
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.zonesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stored: Record<string, StoredZone> = {};
      for (const [zoneId, zone] of this.zones.entries()) {
        stored[zoneId] = {
          zone_name: zone.zone_name,
          created_at: zone.last_seen, // Use last_seen as created_at for simplicity
          last_seen: zone.last_seen,
        };
      }

      fs.writeFileSync(this.zonesPath, JSON.stringify(stored, null, 2));
    } catch (error) {
      logger.error(`Failed to save external zones: ${error}`);
    }
  }

  startTimeoutChecker(): void {
    if (this.timeoutChecker) return;

    this.timeoutChecker = setInterval(() => {
      this.checkTimeouts();
    }, TIMEOUT_CHECK_INTERVAL);
  }

  stopTimeoutChecker(): void {
    if (this.timeoutChecker) {
      clearInterval(this.timeoutChecker);
      this.timeoutChecker = null;
    }
  }

  private checkTimeouts(): void {
    const now = Date.now();

    for (const zone of this.zones.values()) {
      if (zone.source_status === 'connected') {
        const lastSeen = new Date(zone.last_seen).getTime();
        if (now - lastSeen > DISCONNECT_TIMEOUT) {
          logger.info(`External zone timed out: ${zone.zone_id}`);
          zone.source_status = 'disconnected';
          zone.state = 'stopped';

          this.emit('now_playing', {
            zone_id: zone.zone_id,
            state: 'stopped',
            track: zone.track,
            seek_position: zone.seek_position,
          });
        }
      }
    }
  }

  async updateZone(zoneId: string, payload: ExternalUpdatePayload): Promise<ExternalUpdateResponse> {
    const isNewZone = !this.zones.has(zoneId);
    const now = new Date().toISOString();

    // Build track if playing/paused
    let track: Track | null = null;
    let artworkKey: string | null = null;

    if (payload.state !== 'stopped' && payload.title && payload.artist) {
      // Handle artwork
      if (payload.artwork_url && this.artworkCallback) {
        artworkKey = await this.artworkCallback(payload.artwork_url);
      }

      track = {
        title: payload.title,
        artist: payload.artist,
        album: payload.album || 'Unknown Album',
        duration_seconds: payload.duration_seconds || 0,
        artwork_key: artworkKey,
      };
    }

    const zone: ExternalZone = {
      zone_id: zoneId,
      zone_name: payload.zone_name,
      state: payload.state,
      track,
      seek_position: payload.seek_position || 0,
      source_status: 'connected',
      last_seen: now,
    };

    this.zones.set(zoneId, zone);
    this.save();

    // Emit events
    if (isNewZone) {
      this.emit('zones', this.getZones());
    }

    this.emit('now_playing', {
      zone_id: zone.zone_id,
      state: zone.state,
      track: zone.track,
      seek_position: zone.seek_position,
    });

    return {
      success: true,
      zone_id: zoneId,
      artwork_key: artworkKey || undefined,
    };
  }

  deleteZone(zoneId: string): boolean {
    if (!this.zones.has(zoneId)) {
      return false;
    }

    this.zones.delete(zoneId);
    this.save();
    this.emit('zones', this.getZones());
    return true;
  }

  getZones(): Zone[] {
    return Array.from(this.zones.values()).map((z) => ({
      id: z.zone_id,
      display_name: z.zone_name,
    }));
  }

  getNowPlaying(zoneId: string): NowPlaying | null {
    const zone = this.zones.get(zoneId);
    if (!zone) return null;

    return {
      zone_id: zone.zone_id,
      state: zone.state,
      track: zone.track,
      seek_position: zone.seek_position,
    };
  }

  getExternalZones(): ExternalZone[] {
    return Array.from(this.zones.values());
  }

  hasZone(zoneId: string): boolean {
    return this.zones.has(zoneId);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- packages/server/src/externalSources.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/externalSources.ts packages/server/src/externalSources.spec.ts
git commit -m "feat(server): add external source manager"
```

---

## Task 4: Create Sources API Routes

**Files:**
- Create: `packages/server/src/routes/sources.ts`

**Step 1: Create the routes file**

Create `packages/server/src/routes/sources.ts`:

```typescript
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
    const zoneId = req.params.zoneId;
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
    const zoneId = req.params.zoneId;
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
```

**Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/server/src/routes/sources.ts
git commit -m "feat(server): add external sources API routes"
```

---

## Task 5: Create Artwork Utility for External Sources

**Files:**
- Modify: `packages/server/src/artwork.ts`

**Step 1: Add artwork caching function for external sources**

Add these functions to `packages/server/src/artwork.ts` after the `cacheArtwork` function:

```typescript
import { createHash } from 'crypto';

// ... existing code ...

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
```

Also add the import at the top of the file:

```typescript
import { createHash } from 'crypto';
```

**Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/server/src/artwork.ts
git commit -m "feat(server): add external artwork caching utilities"
```

---

## Task 6: Integrate External Sources into WebSocket Manager

**Files:**
- Modify: `packages/server/src/websocket.ts`

**Step 1: Update WebSocketManager to handle external sources**

Modify `packages/server/src/websocket.ts`:

1. Add import at the top:
```typescript
import { ExternalSourceManager } from './externalSources.js';
```

2. Update constructor to accept ExternalSourceManager:
```typescript
export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientState> = new Map();
  private clientsById: Map<string, ClientState> = new Map();
  private roonClient: RoonClient;
  private externalSourceManager: ExternalSourceManager | null = null;
  private friendlyNames: Map<string, string> = new Map();
  private onFriendlyNameChange?: (clientId: string, name: string | null) => void;

  constructor(server: Server, roonClient: RoonClient) {
    // ... existing code ...
  }

  setExternalSourceManager(manager: ExternalSourceManager): void {
    this.externalSourceManager = manager;
    this.setupExternalSourceListeners();
  }
```

3. Add method to set up external source listeners:
```typescript
  private setupExternalSourceListeners(): void {
    if (!this.externalSourceManager) return;

    this.externalSourceManager.on('zones', () => {
      // Broadcast combined zones from both Roon and external sources
      this.broadcastToAll({
        type: 'zones',
        zones: this.getCombinedZones(),
      });
    });

    this.externalSourceManager.on('now_playing', (nowPlaying: NowPlaying) => {
      const message: ServerNowPlayingMessage = {
        type: 'now_playing',
        zone_id: nowPlaying.zone_id,
        state: nowPlaying.state,
        track: nowPlaying.track,
        seek_position: nowPlaying.seek_position,
      };
      this.broadcastToZoneSubscribers(nowPlaying.zone_id, message);
    });

    this.externalSourceManager.on('seek', (zoneId: string, position: number) => {
      const message: ServerSeekMessage = {
        type: 'seek',
        zone_id: zoneId,
        seek_position: position,
      };
      this.broadcastToZoneSubscribers(zoneId, message);
    });
  }
```

4. Add method to get combined zones:
```typescript
  private getCombinedZones(): Zone[] {
    const roonZones = this.roonClient.getZones();
    const externalZones = this.externalSourceManager?.getZones() || [];
    return [...roonZones, ...externalZones];
  }
```

5. Update `setupRoonListeners` to use combined zones:
```typescript
    this.roonClient.on('zones', (zones: Zone[]) => {
      const message: ServerZonesMessage = {
        type: 'zones',
        zones: this.getCombinedZones(),
      };
      this.broadcastToAll(message);
    });
```

6. Update `setupWebSocketServer` to send combined zones:
```typescript
      // Send current zones list
      this.sendToClient(ws, {
        type: 'zones',
        zones: this.getCombinedZones(),
      });
```

7. Update `handleSubscribe` to check both sources:
```typescript
  private handleSubscribe(clientState: ClientState, zoneId: string): void {
    clientState.subscribedZoneId = zoneId;

    // Find zone name from either Roon or external sources
    let zone = this.roonClient.getZones().find((z) => z.id === zoneId);
    if (!zone && this.externalSourceManager) {
      zone = this.externalSourceManager.getZones().find((z) => z.id === zoneId);
    }
    clientState.subscribedZoneName = zone?.display_name || null;

    logger.info(`Client subscribed to zone: ${zoneId}`);

    // Send current now_playing state for the zone
    let nowPlaying = this.roonClient.getNowPlaying(zoneId);
    if (!nowPlaying && this.externalSourceManager) {
      nowPlaying = this.externalSourceManager.getNowPlaying(zoneId);
    }

    if (nowPlaying) {
      this.sendToClient(clientState.ws, {
        type: 'now_playing',
        zone_id: nowPlaying.zone_id,
        state: nowPlaying.state,
        track: nowPlaying.track,
        seek_position: nowPlaying.seek_position,
      });
    }

    // ... rest of existing code ...
  }
```

8. Update `getZones` method:
```typescript
  getZones(): Zone[] {
    return this.getCombinedZones();
  }
```

9. Update `pushSettingsToClient` to check both sources for zone name:
```typescript
    // Find zone name if zoneId provided
    let zoneName: string | undefined;
    if (settings.zoneId) {
      let zone = this.roonClient.getZones().find((z) => z.id === settings.zoneId);
      if (!zone && this.externalSourceManager) {
        zone = this.externalSourceManager.getZones().find((z) => z.id === settings.zoneId);
      }
      zoneName = zone?.display_name;
    }
```

**Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

**Step 3: Run tests**

Run: `pnpm test`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/websocket.ts
git commit -m "feat(server): integrate external sources into WebSocket manager"
```

---

## Task 7: Wire Up External Sources in Server Entry Point

**Files:**
- Modify: `packages/server/src/index.ts`

**Step 1: Update server entry point**

Modify `packages/server/src/index.ts`:

1. Add imports:
```typescript
import { ExternalSourceManager } from './externalSources.js';
import { SourcesConfigStore } from './sourcesConfig.js';
import { createSourcesRouter } from './routes/sources.js';
import { cacheExternalArtwork } from './artwork.js';
```

2. In the `main` function, after initializing the client name store:
```typescript
  // Initialize sources config store
  const sourcesConfigStore = new SourcesConfigStore();

  // Initialize external source manager
  const externalSourceManager = new ExternalSourceManager();
  externalSourceManager.setArtworkCallback(cacheExternalArtwork);
```

3. After initializing WebSocket manager:
```typescript
  // Connect external source manager to WebSocket
  wsManager.setExternalSourceManager(externalSourceManager);
```

4. Add the sources router after the facts router:
```typescript
  app.use('/api/sources', createSourcesRouter(externalSourceManager, sourcesConfigStore));
```

5. Update the zones endpoint to include source type:
```typescript
  // Zones endpoint
  app.get('/api/zones', (_req, res) => {
    const roonZones = roonClient.getZones().map(z => ({ ...z, source: 'roon' as const }));
    const externalZones = externalSourceManager.getZones().map(z => ({ ...z, source: 'external' as const }));
    res.json({
      zones: [...roonZones, ...externalZones],
      connected: roonClient.isConnected(),
    });
  });
```

**Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

**Step 3: Run tests**

Run: `pnpm test`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): wire up external sources in server entry point"
```

---

## Task 8: Add Admin Panel UI for External Sources

**Files:**
- Modify: `packages/client/src/views/AdminView.vue`

**Step 1: Add External Sources section to admin panel**

This task involves adding a new "Sources" section to the existing admin sidebar with:
- API Key management (toggle auth, generate key, copy key)
- List of external zones with status and delete button

The implementation details depend on the current AdminView structure. Add a new section similar to existing sections with:

1. A "Sources" menu item in the sidebar
2. A sources panel with:
   - Toggle for "Require API Key"
   - Show/generate/copy API key functionality
   - Table of external zones with columns: Name, Zone ID, Status, Last Seen, Actions (Delete)

**Step 2: Run dev server to test**

Run: `pnpm dev`
Expected: Admin panel should show new Sources section

**Step 3: Commit**

```bash
git add packages/client/src/views/AdminView.vue
git commit -m "feat(client): add external sources section to admin panel"
```

---

## Task 9: Create Integration Documentation

**Files:**
- Create: `docs/external-api.md`

**Step 1: Create the documentation file**

Create `docs/external-api.md`:

```markdown
# External Sources API

This API allows external music sources to push now-playing data to the Roon Screen Cover display system.

## Overview

External sources appear as zones alongside Roon zones. Display clients can subscribe to any zone, regardless of whether it's from Roon or an external source.

## Quick Start

Push a now-playing update:

```bash
curl -X POST http://localhost:3000/api/sources/my-player/now-playing \
  -H "Content-Type: application/json" \
  -d '{
    "zone_name": "My Music Player",
    "state": "playing",
    "title": "Song Title",
    "artist": "Artist Name",
    "album": "Album Name",
    "duration_seconds": 180,
    "seek_position": 0
  }'
```

## Authentication

By default, the API is open (no authentication required). You can enable API key authentication in the admin panel.

When enabled, include the API key in your requests:

```bash
curl -X POST http://localhost:3000/api/sources/my-player/now-playing \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{ ... }'
```

## API Reference

### Push Now-Playing Update

```
POST /api/sources/:zoneId/now-playing
```

Creates or updates a zone with current playback state.

**Path Parameters:**
- `zoneId` - Stable identifier for your source (e.g., `spotify-office`, `plex-living-room`)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `zone_name` | string | Yes | Display name shown in UI |
| `state` | string | Yes | `playing`, `paused`, or `stopped` |
| `title` | string | When playing | Track title |
| `artist` | string | When playing | Artist name |
| `album` | string | No | Album name |
| `duration_seconds` | number | No | Track length in seconds |
| `seek_position` | number | No | Current position in seconds |
| `artwork_url` | string | No | URL to album artwork |
| `artwork_base64` | string | No | Base64-encoded image |

**Response:**

```json
{
  "success": true,
  "zone_id": "my-player",
  "artwork_key": "abc123"
}
```

### Delete Zone

```
DELETE /api/sources/:zoneId
```

Permanently removes a zone.

### List Zones

```
GET /api/sources
```

Returns all external zones.

## Best Practices

### Zone ID Naming

Use stable, descriptive zone IDs:
- `spotify-living-room` - Good
- `plex-office` - Good
- `temp-12345` - Bad (not stable)

### Update Frequency

- Send updates every 1-5 seconds when playing
- Send a single update when pausing/stopping
- No need to send updates while paused

### Artwork

- Prefer `artwork_url` over `artwork_base64` (less bandwidth)
- Keep images under 1000x1000 pixels
- Use JPEG format for best compatibility

### Graceful Shutdown

When your player stops, send a final update with `state: "stopped"`:

```bash
curl -X POST http://localhost:3000/api/sources/my-player/now-playing \
  -H "Content-Type: application/json" \
  -d '{"zone_name": "My Player", "state": "stopped"}'
```

## Example Integrations

### Shell Script

```bash
#!/bin/bash
# Simple now-playing updater

API_URL="http://localhost:3000/api/sources/my-script/now-playing"

update_now_playing() {
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"zone_name\": \"My Script Player\",
      \"state\": \"$1\",
      \"title\": \"$2\",
      \"artist\": \"$3\",
      \"album\": \"$4\"
    }"
}

# Example usage
update_now_playing "playing" "Song Name" "Artist" "Album"
```

### Python

```python
import requests
import time

API_URL = "http://localhost:3000/api/sources/python-player/now-playing"

def update_now_playing(state, title=None, artist=None, album=None, position=0):
    payload = {
        "zone_name": "Python Player",
        "state": state,
    }
    if state != "stopped":
        payload.update({
            "title": title,
            "artist": artist,
            "album": album,
            "seek_position": position,
        })

    response = requests.post(API_URL, json=payload)
    return response.json()

# Example: Update every second while playing
position = 0
while True:
    update_now_playing("playing", "My Song", "My Artist", "My Album", position)
    position += 1
    time.sleep(1)
```

### Node.js

```javascript
const API_URL = 'http://localhost:3000/api/sources/node-player/now-playing';

async function updateNowPlaying(state, track = {}) {
  const payload = {
    zone_name: 'Node.js Player',
    state,
    ...track,
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.json();
}

// Example usage
await updateNowPlaying('playing', {
  title: 'Song Title',
  artist: 'Artist Name',
  album: 'Album Name',
  duration_seconds: 180,
  seek_position: 0,
});
```

## Troubleshooting

### Zone Not Appearing

1. Check the response from your POST request for errors
2. Verify the zone_name and state fields are present
3. Check server logs for validation errors

### Zone Shows as Disconnected

Zones automatically become "disconnected" after 60 seconds of no updates. Send regular updates while playing.

### Authentication Errors

If you get a 401 response:
1. Check if API key authentication is enabled in the admin panel
2. Verify your `X-API-Key` header is correct
3. Generate a new key if needed
```

**Step 2: Commit**

```bash
git add docs/external-api.md
git commit -m "docs: add external sources API documentation"
```

---

## Task 10: End-to-End Testing

**Step 1: Build and start the server**

Run: `pnpm build && pnpm start`

**Step 2: Test the API manually**

```bash
# Create a zone
curl -X POST http://localhost:3000/api/sources/test-player/now-playing \
  -H "Content-Type: application/json" \
  -d '{
    "zone_name": "Test Player",
    "state": "playing",
    "title": "Test Song",
    "artist": "Test Artist",
    "album": "Test Album",
    "duration_seconds": 180,
    "seek_position": 0
  }'

# List zones
curl http://localhost:3000/api/zones

# List external zones
curl http://localhost:3000/api/sources

# Delete zone
curl -X DELETE http://localhost:3000/api/sources/test-player
```

**Step 3: Test in browser**

1. Open http://localhost:3000 in a browser
2. Verify the external zone appears in zone selector
3. Subscribe to the external zone
4. Send updates via curl and verify they appear on the display

**Step 4: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify external sources integration"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add shared types | `packages/shared/src/index.ts` |
| 2 | Create sources config store | `packages/server/src/sourcesConfig.ts` |
| 3 | Create external source manager | `packages/server/src/externalSources.ts` |
| 4 | Create sources API routes | `packages/server/src/routes/sources.ts` |
| 5 | Add artwork utilities | `packages/server/src/artwork.ts` |
| 6 | Integrate into WebSocket | `packages/server/src/websocket.ts` |
| 7 | Wire up in server entry | `packages/server/src/index.ts` |
| 8 | Add admin panel UI | `packages/client/src/views/AdminView.vue` |
| 9 | Create documentation | `docs/external-api.md` |
| 10 | End-to-end testing | Manual testing |
