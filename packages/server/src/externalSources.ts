import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import type {
  Zone,
  NowPlaying,
  Track,
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
          created_at: zone.last_seen,
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
