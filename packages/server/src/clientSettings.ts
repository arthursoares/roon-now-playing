import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import type { PersistedClientSettings } from '@roon-screen-cover/shared';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_FILE = path.join(DATA_DIR, 'client-settings.json');

export type ClientSettings = PersistedClientSettings;

export class ClientSettingsStore {
  private settings: Map<string, ClientSettings> = new Map();
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_FILE;
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        type LegacyClientSettings = Omit<ClientSettings, 'fontScaleOverride' | 'artworkScaleOverride' | 'enabledLayouts'> &
          Partial<Pick<ClientSettings, 'fontScaleOverride' | 'artworkScaleOverride' | 'enabledLayouts'>>;
        const parsed = JSON.parse(data) as Record<string, LegacyClientSettings>;
        this.settings = new Map(
          Object.entries(parsed).map(([deviceId, settings]) => [deviceId, {
            ...settings,
            fontScaleOverride: settings.fontScaleOverride ?? null,
            artworkScaleOverride: settings.artworkScaleOverride ?? null,
            enabledLayouts: settings.enabledLayouts ?? null,
          }])
        );
        logger.info(`Loaded ${this.settings.size} client settings from ${this.filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to load client settings: ${error}`);
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = Object.fromEntries(this.settings);
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`Failed to save client settings: ${error}`);
    }
  }

  get(deviceId: string): ClientSettings | null {
    return this.settings.get(deviceId) || null;
  }

  set(deviceId: string, settings: ClientSettings): void {
    this.settings.set(deviceId, settings);
    this.save();
  }

  delete(deviceId: string): void {
    this.settings.delete(deviceId);
    this.save();
  }
}
