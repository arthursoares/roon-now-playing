import fs from 'fs';
import path from 'path';
import type { FactsConfig, LLMProvider } from '@roon-screen-cover/shared';
import { DEFAULT_FACTS_PROMPT } from '@roon-screen-cover/shared';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_CONFIG_PATH = path.join(DATA_DIR, 'facts-config.json');

export const DEFAULT_CONFIG: FactsConfig = {
  provider: 'anthropic' as LLMProvider,
  model: 'claude-sonnet-4-20250514',
  apiKey: '',
  factsCount: 5,
  rotationInterval: 25,
  prompt: DEFAULT_FACTS_PROMPT,
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
        logger.info(`Loaded facts config from ${this.configPath}`);
      }
    } catch (error) {
      logger.error(`Failed to load facts config: ${error}`);
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
      logger.error(`Failed to save facts config: ${error}`);
    }
  }

  get(): FactsConfig {
    // Environment variables take precedence
    const envKey = this.config.provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY;

    return {
      ...this.config,
      apiKey: envKey || this.config.apiKey,
    };
  }

  update(partial: Partial<FactsConfig>): void {
    this.config = { ...this.config, ...partial };
    this.save();
  }

  hasApiKey(): boolean {
    return !!this.get().apiKey;
  }
}
