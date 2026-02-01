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
