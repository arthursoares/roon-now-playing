import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import type { FactsConfig, LLMProvider } from '@roon-screen-cover/shared';
import {
  DEFAULT_FACTS_PROMPT,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_OPENAI_REASONING_EFFORT,
  getOpenAIReasoningEffort,
  getRecommendedFactsOutputTokens,
  LLM_PROVIDERS,
  MAX_OUTPUT_TOKENS,
  migrateOpenAIFactsModel,
  MIN_OUTPUT_TOKENS,
  OPENAI_REASONING_EFFORTS,
} from '@roon-screen-cover/shared';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_CONFIG_PATH = path.join(DATA_DIR, 'facts-config.json');
const DEFAULT_LOCAL_BASE_URL = 'http://localhost:11434/v1';
const MIN_FACTS_COUNT = 1;
const MAX_FACTS_COUNT = 10;
const MIN_ROTATION_INTERVAL = 5;
const MAX_ROTATION_INTERVAL = 60;
const MAX_MODEL_LENGTH = 256;
const MAX_API_KEY_LENGTH = 16_384;
const MAX_PROMPT_LENGTH = 50_000;
const MAX_LOCAL_BASE_URL_LENGTH = 2_048;
// SHA-256 of the v1.10 built-in prompt. Exact matches migrate; custom prompts remain untouched.
const V1_10_DEFAULT_PROMPT_SHA256 = 'e606ad5cee984b9eb2ce9d5ca00388a55d71be74d002169c15cde03d7ac00d04';

const WRITABLE_FIELDS = [
  'provider', 'model', 'apiKey', 'factsCount', 'rotationInterval', 'prompt',
  'maxOutputTokens', 'openaiReasoningEffort', 'localBaseUrl',
] as const satisfies readonly (keyof FactsConfig)[];
const WRITABLE_FIELD_SET = new Set<string>(WRITABLE_FIELDS);
const READ_ONLY_FIELDS = new Set(['hasApiKey']);

export const DEFAULT_CONFIG: FactsConfig = {
  provider: 'anthropic' as LLMProvider,
  model: 'claude-haiku-4-5',
  apiKey: '',
  factsCount: 5,
  rotationInterval: 25,
  prompt: DEFAULT_FACTS_PROMPT,
  maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  openaiReasoningEffort: DEFAULT_OPENAI_REASONING_EFFORT,
  localBaseUrl: DEFAULT_LOCAL_BASE_URL,
};

export function isValidMaxOutputTokens(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= MIN_OUTPUT_TOKENS
    && value <= MAX_OUTPUT_TOKENS;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isBoundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === 'string'
    && value.length <= maximum
    && (allowEmpty || value.trim().length > 0);
}

function containsNonAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 127) return true;
  }
  return false;
}

export type FactsConfigUpdateValidation =
  | { value: Partial<FactsConfig> }
  | { error: string };

export function validateFactsConfigUpdate(input: unknown): FactsConfigUpdateValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { error: 'Facts config update must be an object' };
  }

  const record = input as Record<string, unknown>;
  const unknownField = Object.keys(record).find(
    (field) => !WRITABLE_FIELD_SET.has(field) && !READ_ONLY_FIELDS.has(field),
  );
  if (unknownField) return { error: `Unknown facts config field: ${unknownField}` };

  const value: Partial<FactsConfig> = {};
  if (record.provider !== undefined) {
    if (typeof record.provider !== 'string' || !(LLM_PROVIDERS as readonly string[]).includes(record.provider)) {
      return { error: `provider must be one of: ${LLM_PROVIDERS.join(', ')}` };
    }
    value.provider = record.provider as LLMProvider;
  }
  if (record.model !== undefined) {
    if (!isBoundedString(record.model, MAX_MODEL_LENGTH)) {
      return { error: `model must be a non-empty string no longer than ${MAX_MODEL_LENGTH} characters` };
    }
    value.model = record.model;
  }
  if (record.apiKey !== undefined) {
    if (!isBoundedString(record.apiKey, MAX_API_KEY_LENGTH, true)) {
      return { error: `apiKey must be a string no longer than ${MAX_API_KEY_LENGTH} characters` };
    }
    value.apiKey = record.apiKey;
  }
  if (record.factsCount !== undefined) {
    if (!isIntegerInRange(record.factsCount, MIN_FACTS_COUNT, MAX_FACTS_COUNT)) {
      return { error: `factsCount must be an integer between ${MIN_FACTS_COUNT} and ${MAX_FACTS_COUNT}` };
    }
    value.factsCount = record.factsCount;
  }
  if (record.rotationInterval !== undefined) {
    if (!isIntegerInRange(record.rotationInterval, MIN_ROTATION_INTERVAL, MAX_ROTATION_INTERVAL)) {
      return { error: `rotationInterval must be an integer between ${MIN_ROTATION_INTERVAL} and ${MAX_ROTATION_INTERVAL}` };
    }
    value.rotationInterval = record.rotationInterval;
  }
  if (record.prompt !== undefined) {
    if (!isBoundedString(record.prompt, MAX_PROMPT_LENGTH)) {
      return { error: `prompt must be a non-empty string no longer than ${MAX_PROMPT_LENGTH} characters` };
    }
    value.prompt = record.prompt;
  }
  if (record.maxOutputTokens !== undefined) {
    if (!isValidMaxOutputTokens(record.maxOutputTokens)) {
      return { error: `maxOutputTokens must be an integer between ${MIN_OUTPUT_TOKENS} and ${MAX_OUTPUT_TOKENS}` };
    }
    value.maxOutputTokens = record.maxOutputTokens;
  }
  if (record.openaiReasoningEffort !== undefined) {
    if (typeof record.openaiReasoningEffort !== 'string'
      || !(OPENAI_REASONING_EFFORTS as readonly string[]).includes(record.openaiReasoningEffort)) {
      return { error: `openaiReasoningEffort must be one of: ${OPENAI_REASONING_EFFORTS.join(', ')}` };
    }
    value.openaiReasoningEffort = record.openaiReasoningEffort as FactsConfig['openaiReasoningEffort'];
  }
  if (record.localBaseUrl !== undefined) {
    if (typeof record.localBaseUrl !== 'string') {
      return { error: `localBaseUrl must be a non-empty string no longer than ${MAX_LOCAL_BASE_URL_LENGTH} characters` };
    }
    const localBaseUrl = record.localBaseUrl.trim();
    if (!isBoundedString(localBaseUrl, MAX_LOCAL_BASE_URL_LENGTH)) {
      return { error: `localBaseUrl must be a non-empty string no longer than ${MAX_LOCAL_BASE_URL_LENGTH} characters` };
    }
    let parsed: URL;
    try {
      parsed = new URL(localBaseUrl);
    } catch {
      return { error: 'localBaseUrl must be a valid HTTP or HTTPS URL' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: 'localBaseUrl must be a valid HTTP or HTTPS URL' };
    }
    value.localBaseUrl = localBaseUrl;
  }

  return { value };
}

interface ModelMigration {
  from: string;
  to: string;
}

function migrateConfigModel(config: FactsConfig): ModelMigration | null {
  if (config.provider !== 'openai') return null;
  const previousModel = config.model;
  const migratedModel = migrateOpenAIFactsModel(previousModel);
  if (migratedModel === previousModel) return null;
  config.model = migratedModel;
  if (previousModel !== 'gpt-5.6') {
    config.openaiReasoningEffort = getOpenAIReasoningEffort(migratedModel)
      ?? DEFAULT_OPENAI_REASONING_EFFORT;
  }
  return { from: previousModel, to: migratedModel };
}

function logModelMigration(migration: ModelMigration): void {
  logger.info(`Migrated OpenAI facts model from ${migration.from} to ${migration.to}`);
}

function normalizeStoredConfig(input: unknown): { config: FactsConfig; migration: ModelMigration | null } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { config: { ...DEFAULT_CONFIG }, migration: null };
  }
  const record = input as Record<string, unknown>;
  const normalized: FactsConfig = { ...DEFAULT_CONFIG };
  for (const field of WRITABLE_FIELDS) {
    if (field === 'maxOutputTokens') continue;
    if (record[field] === undefined) continue;
    const validation = validateFactsConfigUpdate({ [field]: record[field] });
    if ('value' in validation) Object.assign(normalized, validation.value);
  }
  if (createHash('sha256').update(normalized.prompt).digest('hex') === V1_10_DEFAULT_PROMPT_SHA256) {
    normalized.prompt = DEFAULT_FACTS_PROMPT;
  }
  const migration = migrateConfigModel(normalized);
  normalized.maxOutputTokens = isValidMaxOutputTokens(record.maxOutputTokens)
    ? record.maxOutputTokens
    : getRecommendedFactsOutputTokens(normalized.provider, normalized.model);
  if (normalized.apiKey && containsNonAscii(normalized.apiKey)) {
    logger.warn('Clearing corrupted API key from config');
    normalized.apiKey = '';
  }
  return { config: normalized, migration };
}

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
      if (!fs.existsSync(this.configPath)) return;
      const data = fs.readFileSync(this.configPath, 'utf-8');
      const parsed: unknown = JSON.parse(data);
      const normalized = normalizeStoredConfig(parsed);
      this.config = normalized.config;
      if (normalized.migration) {
        logModelMigration(normalized.migration);
        this.save();
      }
      logger.info(`Loaded facts config from ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to load facts config: ${error}`);
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error(`Failed to save facts config: ${error}`);
    }
  }

  private getEffectiveApiKey(): string {
    switch (this.config.provider) {
      case 'anthropic': return process.env.ANTHROPIC_API_KEY || this.config.apiKey;
      case 'openai': return process.env.OPENAI_API_KEY || this.config.apiKey;
      case 'openrouter': return process.env.OPENROUTER_API_KEY || this.config.apiKey;
      case 'local': return this.config.apiKey;
      default: return this.config.apiKey;
    }
  }

  private getEffectiveLocalBaseUrl(): string {
    return process.env.LOCAL_LLM_URL?.trim() || this.config.localBaseUrl || DEFAULT_LOCAL_BASE_URL;
  }

  get(): FactsConfig {
    return {
      ...this.config,
      apiKey: this.getEffectiveApiKey(),
      localBaseUrl: this.getEffectiveLocalBaseUrl(),
      openaiReasoningEffort: this.config.provider === 'openai'
        ? getOpenAIReasoningEffort(this.config.model, this.config.openaiReasoningEffort)
        : this.config.openaiReasoningEffort,
    };
  }

  update(partial: Partial<FactsConfig>): void {
    const candidate: Record<string, unknown> = { ...partial };
    if (typeof candidate.apiKey === 'string' && containsNonAscii(candidate.apiKey)) {
      logger.warn('Rejecting API key update: contains non-ASCII characters');
      delete candidate.apiKey;
    }
    const validation = validateFactsConfigUpdate(candidate);
    if ('error' in validation) {
      if (/must be an integer between/.test(validation.error)) throw new RangeError(validation.error);
      throw new TypeError(validation.error);
    }
    if (Object.keys(validation.value).length === 0) return;
    const updated = { ...this.config, ...validation.value };
    const migration = migrateConfigModel(updated);
    this.config = updated;
    if (migration) logModelMigration(migration);
    this.save();
  }

  hasApiKey(): boolean {
    return !!this.get().apiKey;
  }
}
