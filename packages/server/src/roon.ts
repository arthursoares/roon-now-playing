import RoonApi from 'node-roon-api';
import RoonApiTransport, { type Zone as RoonZone } from 'node-roon-api-transport';
import RoonApiImage from 'node-roon-api-image';
import RoonApiStatus from 'node-roon-api-status';
import { EventEmitter } from 'events';
import type { Zone, NowPlaying, Track, PlaybackState } from '@roon-screen-cover/shared';
import { logger } from './logger.js';

// Type definitions for Roon API (not provided by the package)
interface RoonCore {
  core_id: string;
  display_name: string;
  display_version: string;
  services: {
    RoonApiTransport?: RoonApiTransport;
    RoonApiImage?: RoonApiImage;
  };
}

interface RoonNowPlaying {
  one_line?: { line1: string };
  two_line?: { line1: string; line2: string };
  three_line?: { line1: string; line2: string; line3: string };
  length?: number;
  seek_position?: number;
  image_key?: string;
}

interface RoonZoneState {
  zone_id: string;
  display_name: string;
  state: 'playing' | 'paused' | 'loading' | 'stopped';
  now_playing?: RoonNowPlaying;
  seek_position?: number;
}

export interface RoonClientEvents {
  zones: (zones: Zone[]) => void;
  now_playing: (nowPlaying: NowPlaying) => void;
  seek: (zoneId: string, position: number) => void;
  connected: () => void;
  disconnected: () => void;
}

export class RoonClient extends EventEmitter {
  private roon: typeof RoonApi.prototype;
  private core: RoonCore | null = null;
  private transport: RoonApiTransport | null = null;
  private image: RoonApiImage | null = null;
  private zones: Map<string, RoonZoneState> = new Map();
  private seekInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();

    this.roon = new RoonApi({
      extension_id: 'com.github.roon-now-playing',
      display_name: 'Roon Now Playing',
      display_version: '1.3.8',
      publisher: 'roon-screen-cover',
      email: 'noreply@example.com',
      website: 'https://github.com/arthursoares/roon-screen-cover',
      log_level: 'none',

      core_paired: (core: RoonCore) => {
        logger.info(`Paired with Roon Core: ${core.display_name}`);
        this.core = core;
        this.transport = core.services.RoonApiTransport as RoonApiTransport;
        this.image = core.services.RoonApiImage as RoonApiImage;

        this.subscribeToTransport();
        this.emit('connected');
      },

      core_unpaired: (core: RoonCore) => {
        logger.info(`Unpaired from Roon Core: ${core.display_name}`);
        this.core = null;
        this.transport = null;
        this.image = null;
        this.zones.clear();
        this.stopSeekUpdates();
        this.emit('disconnected');
        this.emit('zones', []);
      },
    });

    const svcStatus = new RoonApiStatus(this.roon);

    this.roon.init_services({
      required_services: [RoonApiTransport, RoonApiImage],
      provided_services: [svcStatus],
    });

    svcStatus.set_status('Ready', false);
  }

  start(): void {
    logger.info('Starting Roon discovery...');
    this.roon.start_discovery();
  }

  isConnected(): boolean {
    return this.core !== null;
  }

  getZones(): Zone[] {
    return Array.from(this.zones.values()).map((z) => ({
      id: z.zone_id,
      display_name: z.display_name,
    }));
  }

  getNowPlaying(zoneId: string): NowPlaying | null {
    const zone = this.zones.get(zoneId);
    if (!zone) return null;

    return this.mapZoneToNowPlaying(zone);
  }

  async getArtwork(imageKey: string): Promise<Buffer | null> {
    if (!this.image) {
      logger.warn('Image service not available');
      return null;
    }

    return new Promise((resolve) => {
      this.image!.get_image(imageKey, { scale: 'fit', width: 1000, height: 1000, format: 'image/jpeg' }, (error: Error | null, contentType: string, body: Buffer) => {
        if (error) {
          logger.error(`Failed to fetch artwork: ${error.message}`);
          resolve(null);
        } else {
          resolve(body);
        }
      });
    });
  }

  private subscribeToTransport(): void {
    if (!this.transport) return;

    this.transport.subscribe_zones((cmd: string, data?: { zones?: RoonZoneState[]; zones_added?: RoonZoneState[]; zones_removed?: string[]; zones_changed?: RoonZoneState[]; zones_seek_changed?: Array<{ zone_id: string; seek_position: number }> }) => {
      logger.debug(`Transport event: ${cmd}`, {
        zones: data?.zones?.length,
        zones_added: data?.zones_added?.length,
        zones_removed: data?.zones_removed?.length,
        zones_changed: data?.zones_changed?.length,
      });

      if (!data) return; // Guard against undefined data (e.g., on disconnect)

      if (cmd === 'Subscribed' && data.zones) {
        this.zones.clear();
        for (const zone of data.zones) {
          this.zones.set(zone.zone_id, zone);
        }
        this.emitZones();
        this.emitAllNowPlaying();
        this.startSeekUpdates();
      }

      if (cmd === 'Changed') {
        let zonesListChanged = false;

        // Handle explicitly added zones
        if (data.zones_added) {
          for (const zone of data.zones_added) {
            logger.info(`Zone added: ${zone.display_name} (${zone.zone_id})`);
            this.zones.set(zone.zone_id, zone);
            this.emit('now_playing', this.mapZoneToNowPlaying(zone));
          }
          zonesListChanged = true;
        }

        // Handle removed zones
        if (data.zones_removed) {
          for (const zoneId of data.zones_removed) {
            const zone = this.zones.get(zoneId);
            logger.info(`Zone removed: ${zone?.display_name || zoneId}`);
            this.zones.delete(zoneId);
          }
          zonesListChanged = true;
        }

        // Handle changed zones (may include new zones in some Roon versions)
        if (data.zones_changed) {
          for (const zone of data.zones_changed) {
            const isNewZone = !this.zones.has(zone.zone_id);
            if (isNewZone) {
              logger.info(`Zone appeared via change: ${zone.display_name} (${zone.zone_id})`);
              zonesListChanged = true;
            }
            this.zones.set(zone.zone_id, zone);
            this.emit('now_playing', this.mapZoneToNowPlaying(zone));
          }
        }

        // Emit updated zones list if the list changed
        if (zonesListChanged) {
          this.emitZones();
        }

        // Handle seek position changes
        if (data.zones_seek_changed) {
          for (const seekChange of data.zones_seek_changed) {
            const zone = this.zones.get(seekChange.zone_id);
            if (zone) {
              zone.seek_position = seekChange.seek_position;
              this.emit('seek', seekChange.zone_id, seekChange.seek_position);
            }
          }
        }
      }
    });
  }

  private startSeekUpdates(): void {
    this.stopSeekUpdates();

    // Emit seek updates every second for playing zones
    this.seekInterval = setInterval(() => {
      for (const zone of this.zones.values()) {
        if (zone.state === 'playing' && zone.seek_position !== undefined) {
          this.emit('seek', zone.zone_id, zone.seek_position);
        }
      }
    }, 1000);
  }

  private stopSeekUpdates(): void {
    if (this.seekInterval) {
      clearInterval(this.seekInterval);
      this.seekInterval = null;
    }
  }

  private emitZones(): void {
    this.emit('zones', this.getZones());
  }

  private emitAllNowPlaying(): void {
    for (const zone of this.zones.values()) {
      this.emit('now_playing', this.mapZoneToNowPlaying(zone));
    }
  }

  private mapZoneToNowPlaying(zone: RoonZoneState): NowPlaying {
    const track = this.mapToTrack(zone.now_playing);
    const state = this.mapState(zone.state);

    return {
      zone_id: zone.zone_id,
      state,
      track,
      seek_position: zone.seek_position ?? 0,
    };
  }

  private mapToTrack(nowPlaying?: RoonNowPlaying): Track | null {
    if (!nowPlaying) return null;

    // Extract track info from Roon's three_line format
    const threeLine = nowPlaying.three_line;
    if (!threeLine) return null;

    return {
      title: threeLine.line1 || 'Unknown Title',
      artist: threeLine.line2 || 'Unknown Artist',
      album: threeLine.line3 || 'Unknown Album',
      duration_seconds: nowPlaying.length ?? 0,
      artwork_key: nowPlaying.image_key ?? null,
    };
  }

  private mapState(roonState: string): PlaybackState {
    switch (roonState) {
      case 'playing':
        return 'playing';
      case 'paused':
      case 'loading':
        return 'paused';
      default:
        return 'stopped';
    }
  }
}

// Singleton instance
let roonClient: RoonClient | null = null;

export function getRoonClient(): RoonClient {
  if (!roonClient) {
    roonClient = new RoonClient();
  }
  return roonClient;
}
