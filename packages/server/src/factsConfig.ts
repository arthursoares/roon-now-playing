import fs from 'fs';
import path from 'path';
import type { FactsConfig, LLMProvider } from '@roon-screen-cover/shared';
import { DEFAULT_FACTS_PROMPT } from '@roon-screen-cover/shared';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_CONFIG_PATH = path.join(DATA_DIR, 'facts-config.json');
const DEFAULT_LOCAL_BASE_URL = 'http://localhost:11434/v1';

export const DEFAULT_CONFIG: FactsConfig = {
  provider: 'anthropic' as LLMProvider,
  model: 'claude-sonnet-4-20250514',
  apiKey: '',
  factsCount: 5,
  rotationInterval: 25,
  prompt: DEFAULT_FACTS_PROMPT,
  localBaseUrl: DEFAULT_LOCAL_BASE_URL,
};

export class FactsConfigStore {
  private config: FactsConfig;
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
        const parsed = JSON.parse(data) as Partial<FactsConfig>;
        this.config = { ...DEFAULT_CONFIG, ...parsed };

        // Clear any corrupted API key (e.g., contains mask characters)
        if (this.config.apiKey && this.containsNonAscii(this.config.apiKey)) {
          logger.warn('Clearing corrupted API key from config');
          this.config.apiKey = '';
          this.save();
        }

        logger.info(`Loaded facts config from ${this.configPath}`);
      }
    } catch (error) {
      logger.error(`Failed to load facts config: ${error}`);
    }
  }

  private containsNonAscii(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 127) {
        return true;
      }
    }
    return false;
  }

  private save(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error(`Failed to save facts config: ${error}`);
    }
  }

  private getEffectiveApiKey(): string {
    switch (this.config.provider) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY || this.config.apiKey;
      case 'openai':
        return process.env.OPENAI_API_KEY || this.config.apiKey;
      case 'openrouter':
        return process.env.OPENROUTER_API_KEY || this.config.apiKey;
      case 'local':
        // Local provider doesn't require an API key
        return this.config.apiKey;
      default:
        return this.config.apiKey;
    }
  }

  private getEffectiveLocalBaseUrl(): string {
    return process.env.LOCAL_LLM_URL || this.config.localBaseUrl || DEFAULT_LOCAL_BASE_URL;
  }

  get(): FactsConfig {
    return {
      ...this.config,
      apiKey: this.getEffectiveApiKey(),
      localBaseUrl: this.getEffectiveLocalBaseUrl(),
    };
  }

  update(partial: Partial<FactsConfig>): void {
    // Don't save API keys containing non-ASCII characters (e.g., masked keys with bullets)
    if (partial.apiKey && this.containsNonAscii(partial.apiKey)) {
      logger.warn('Rejecting API key update: contains non-ASCII characters');
      delete partial.apiKey;
    }

    this.config = { ...this.config, ...partial };
    this.save();
  }

  hasApiKey(): boolean {
    return !!this.get().apiKey;
  }
}
