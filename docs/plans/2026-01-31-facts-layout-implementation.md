# Facts Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three LLM-powered layouts that display interesting facts about currently playing tracks.

**Architecture:** Server-side LLM integration with file-backed caching. Client fetches facts via REST API, composable manages state and auto-rotation. Three layout components share the facts composable.

**Tech Stack:** Vue 3, TypeScript, Express, Anthropic SDK, OpenAI SDK, Vitest

---

## Task 1: Install LLM Dependencies

**Files:**
- Modify: `packages/server/package.json`

**Step 1: Install Anthropic and OpenAI SDKs**

Run in worktree root:
```bash
cd packages/server && pnpm add @anthropic-ai/sdk openai
```

**Step 2: Verify installation**

Run: `pnpm list @anthropic-ai/sdk openai`
Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add packages/server/package.json pnpm-lock.yaml
git commit -m "feat(server): add Anthropic and OpenAI SDK dependencies"
```

---

## Task 2: Add Shared Types

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.spec.ts`

**Step 1: Write failing tests for new types**

Add to `packages/shared/src/index.spec.ts`:

```typescript
describe('Facts Types', () => {
  it('should include facts layouts in LAYOUTS', () => {
    expect(LAYOUTS).toContain('facts-columns');
    expect(LAYOUTS).toContain('facts-overlay');
    expect(LAYOUTS).toContain('facts-carousel');
  });

  it('should have correct total number of layouts', () => {
    expect(LAYOUTS).toHaveLength(8); // 5 existing + 3 facts
  });

  it('should export LLM_PROVIDERS constant', () => {
    expect(LLM_PROVIDERS).toContain('anthropic');
    expect(LLM_PROVIDERS).toContain('openai');
    expect(LLM_PROVIDERS).toHaveLength(2);
  });

  it('should export LLM_MODELS for each provider', () => {
    expect(LLM_MODELS.anthropic).toContain('claude-sonnet-4-20250514');
    expect(LLM_MODELS.anthropic).toContain('claude-haiku-4-20250514');
    expect(LLM_MODELS.openai).toContain('gpt-4o');
    expect(LLM_MODELS.openai).toContain('gpt-4o-mini');
  });
});
```

Update imports at top of test file to include:
```typescript
import {
  // ... existing imports
  LLM_PROVIDERS,
  LLM_MODELS,
} from './index';
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/shared`
Expected: FAIL - LLM_PROVIDERS is not exported, facts layouts not in LAYOUTS

**Step 3: Add types to shared index**

Add to `packages/shared/src/index.ts` after BACKGROUND_CONFIG:

```typescript
// LLM Provider options
export const LLM_PROVIDERS = ['anthropic', 'openai'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

// Model options per provider
export const LLM_MODELS = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514'] as const,
  openai: ['gpt-4o', 'gpt-4o-mini'] as const,
} as const;

// Facts configuration (stored on server)
export interface FactsConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  factsCount: number;
  rotationInterval: number;
  prompt: string;
}

// Facts API types
export interface FactsRequest {
  artist: string;
  album: string;
  title: string;
}

export interface FactsResponse {
  facts: string[];
  cached: boolean;
  generatedAt: number;
}

export interface FactsTestRequest {
  artist: string;
  album: string;
  title: string;
}

export interface FactsTestResponse {
  facts: string[];
  durationMs: number;
}

export type FactsErrorType = 'no-key' | 'api-error' | 'empty';

export interface FactsError {
  type: FactsErrorType;
  message: string;
}

// Default prompt template
export const DEFAULT_FACTS_PROMPT = `Generate {factsCount} interesting, lesser-known facts about this music:

Artist: {artist}
Album: {album}
Track: {title}

Focus on:
- Recording history or interesting production details
- Historical context or cultural impact
- Connections to other artists or musical movements
- Awards, chart positions, or notable achievements
- Personal stories from the artist about this work

When possible, include attribution (e.g., "In a 1985 interview..." or "According to Songfacts...").

Keep each fact concise (2-3 sentences max). Prioritize surprising or educational information over common knowledge.

Return ONLY a JSON array of strings, no other text.`;
```

Update LAYOUTS array:
```typescript
export const LAYOUTS = [
  'detailed',
  'minimal',
  'fullscreen',
  'ambient',
  'cover',
  'facts-columns',
  'facts-overlay',
  'facts-carousel',
] as const;
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/shared`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/index.spec.ts
git commit -m "feat(shared): add facts layout types and LLM configuration"
```

---

## Task 3: Create Facts Config Module

**Files:**
- Create: `packages/server/src/factsConfig.ts`
- Create: `packages/server/src/factsConfig.spec.ts`

**Step 1: Write failing test**

Create `packages/server/src/factsConfig.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FactsConfigStore, DEFAULT_CONFIG } from './factsConfig.js';

const TEST_CONFIG_PATH = path.join(process.cwd(), 'test-facts-config.json');

describe('FactsConfigStore', () => {
  let store: FactsConfigStore;

  beforeEach(() => {
    // Clean up any existing test file
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
    store = new FactsConfigStore(TEST_CONFIG_PATH);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it('should return default config when no file exists', () => {
    const config = store.get();
    expect(config.provider).toBe('anthropic');
    expect(config.factsCount).toBe(5);
    expect(config.rotationInterval).toBe(25);
  });

  it('should save and load config', () => {
    store.update({ factsCount: 7 });

    // Create new instance to verify persistence
    const store2 = new FactsConfigStore(TEST_CONFIG_PATH);
    const config = store2.get();
    expect(config.factsCount).toBe(7);
  });

  it('should merge partial updates', () => {
    store.update({ factsCount: 10 });
    store.update({ provider: 'openai' });

    const config = store.get();
    expect(config.factsCount).toBe(10);
    expect(config.provider).toBe('openai');
  });

  it('should prefer environment variable for API key', () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-123';
    store.update({ apiKey: 'config-key' });

    const config = store.get();
    expect(config.apiKey).toBe('env-key-123');

    delete process.env.ANTHROPIC_API_KEY;
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/server/src/factsConfig`
Expected: FAIL - Cannot find module './factsConfig.js'

**Step 3: Implement FactsConfigStore**

Create `packages/server/src/factsConfig.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/server/src/factsConfig`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/factsConfig.ts packages/server/src/factsConfig.spec.ts
git commit -m "feat(server): add facts configuration store with file persistence"
```

---

## Task 4: Create Facts Cache Module

**Files:**
- Create: `packages/server/src/factsCache.ts`
- Create: `packages/server/src/factsCache.spec.ts`

**Step 1: Write failing test**

Create `packages/server/src/factsCache.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FactsCache } from './factsCache.js';

const TEST_CACHE_PATH = path.join(process.cwd(), 'test-facts-cache.json');
const TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

describe('FactsCache', () => {
  let cache: FactsCache;

  beforeEach(() => {
    if (fs.existsSync(TEST_CACHE_PATH)) {
      fs.unlinkSync(TEST_CACHE_PATH);
    }
    cache = new FactsCache(TEST_CACHE_PATH);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CACHE_PATH)) {
      fs.unlinkSync(TEST_CACHE_PATH);
    }
  });

  it('should return null for uncached tracks', () => {
    const result = cache.get('Artist', 'Album', 'Title');
    expect(result).toBeNull();
  });

  it('should store and retrieve facts', () => {
    const facts = ['Fact 1', 'Fact 2'];
    cache.set('Artist', 'Album', 'Title', facts);

    const result = cache.get('Artist', 'Album', 'Title');
    expect(result).toEqual(facts);
  });

  it('should normalize keys (case-insensitive)', () => {
    const facts = ['Fact 1'];
    cache.set('ARTIST', 'ALBUM', 'TITLE', facts);

    const result = cache.get('artist', 'album', 'title');
    expect(result).toEqual(facts);
  });

  it('should persist to disk', () => {
    const facts = ['Persisted fact'];
    cache.set('Artist', 'Album', 'Title', facts);

    // Create new instance to test persistence
    const cache2 = new FactsCache(TEST_CACHE_PATH);
    const result = cache2.get('Artist', 'Album', 'Title');
    expect(result).toEqual(facts);
  });

  it('should expire entries after TTL', () => {
    const facts = ['Old fact'];
    cache.set('Artist', 'Album', 'Title', facts);

    // Fast-forward time past TTL
    vi.useFakeTimers();
    vi.advanceTimersByTime(TTL_MS + 1000);

    const result = cache.get('Artist', 'Album', 'Title');
    expect(result).toBeNull();

    vi.useRealTimers();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/server/src/factsCache`
Expected: FAIL - Cannot find module './factsCache.js'

**Step 3: Implement FactsCache**

Create `packages/server/src/factsCache.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || './config';
const DEFAULT_CACHE_PATH = path.join(DATA_DIR, 'facts-cache.json');
const TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

interface CacheEntry {
  facts: string[];
  timestamp: number;
}

export class FactsCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cachePath: string;

  constructor(cachePath: string = DEFAULT_CACHE_PATH) {
    this.cachePath = cachePath;
    this.load();
  }

  private makeKey(artist: string, album: string, title: string): string {
    return `${artist.toLowerCase()}::${album.toLowerCase()}::${title.toLowerCase()}`;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = fs.readFileSync(this.cachePath, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, CacheEntry>;
        this.cache = new Map(Object.entries(parsed));
        logger.info(`Loaded ${this.cache.size} cached facts from ${this.cachePath}`);
      }
    } catch (error) {
      logger.error(`Failed to load facts cache: ${error}`);
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.cache);
      fs.writeFileSync(this.cachePath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`Failed to save facts cache: ${error}`);
    }
  }

  get(artist: string, album: string, title: string): string[] | null {
    const key = this.makeKey(artist, album, title);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.cache.delete(key);
      this.save();
      return null;
    }

    return entry.facts;
  }

  set(artist: string, album: string, title: string, facts: string[]): void {
    const key = this.makeKey(artist, album, title);
    this.cache.set(key, {
      facts,
      timestamp: Date.now(),
    });
    this.save();
  }

  getTimestamp(artist: string, album: string, title: string): number | null {
    const key = this.makeKey(artist, album, title);
    const entry = this.cache.get(key);
    return entry?.timestamp ?? null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/server/src/factsCache`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/factsCache.ts packages/server/src/factsCache.spec.ts
git commit -m "feat(server): add facts cache with file persistence and 72h TTL"
```

---

## Task 5: Create LLM Provider Module

**Files:**
- Create: `packages/server/src/llm.ts`
- Create: `packages/server/src/llm.spec.ts`

**Step 1: Write failing test**

Create `packages/server/src/llm.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createLLMProvider, AnthropicProvider, OpenAIProvider } from './llm.js';
import type { FactsConfig } from '@roon-screen-cover/shared';

// Mock the SDKs
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '["Fact 1", "Fact 2", "Fact 3"]' }],
      }),
    },
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '["Fact 1", "Fact 2"]' } }],
        }),
      },
    },
  })),
}));

describe('LLM Providers', () => {
  const baseConfig: FactsConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: 'test-key',
    factsCount: 5,
    rotationInterval: 25,
    prompt: 'Generate {factsCount} facts about {artist} - {title} from {album}',
  };

  describe('createLLMProvider', () => {
    it('should create AnthropicProvider for anthropic', () => {
      const provider = createLLMProvider({ ...baseConfig, provider: 'anthropic' });
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should create OpenAIProvider for openai', () => {
      const provider = createLLMProvider({ ...baseConfig, provider: 'openai' });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('AnthropicProvider', () => {
    it('should generate facts', async () => {
      const provider = new AnthropicProvider(baseConfig);
      const facts = await provider.generateFacts('Artist', 'Album', 'Title');
      expect(Array.isArray(facts)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);
    });
  });

  describe('OpenAIProvider', () => {
    it('should generate facts', async () => {
      const config = { ...baseConfig, provider: 'openai' as const, model: 'gpt-4o' };
      const provider = new OpenAIProvider(config);
      const facts = await provider.generateFacts('Artist', 'Album', 'Title');
      expect(Array.isArray(facts)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/server/src/llm`
Expected: FAIL - Cannot find module './llm.js'

**Step 3: Implement LLM providers**

Create `packages/server/src/llm.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { FactsConfig, LLMProvider as LLMProviderType } from '@roon-screen-cover/shared';
import { logger } from './logger.js';

export interface LLMProvider {
  generateFacts(artist: string, album: string, title: string): Promise<string[]>;
}

function buildPrompt(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

function parseFactsResponse(text: string): string[] {
  try {
    // Try to extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return parsed;
      }
    }
  } catch (error) {
    logger.error(`Failed to parse LLM response: ${error}`);
  }
  return [];
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private config: FactsConfig;

  constructor(config: FactsConfig) {
    this.config = config;
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async generateFacts(artist: string, album: string, title: string): Promise<string[]> {
    const prompt = buildPrompt(this.config.prompt, {
      artist,
      album,
      title,
      factsCount: this.config.factsCount,
    });

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        return parseFactsResponse(textContent.text);
      }
    } catch (error) {
      logger.error(`Anthropic API error: ${error}`);
      throw error;
    }

    return [];
  }
}

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private config: FactsConfig;

  constructor(config: FactsConfig) {
    this.config = config;
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async generateFacts(artist: string, album: string, title: string): Promise<string[]> {
    const prompt = buildPrompt(this.config.prompt, {
      artist,
      album,
      title,
      factsCount: this.config.factsCount,
    });

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return parseFactsResponse(content);
      }
    } catch (error) {
      logger.error(`OpenAI API error: ${error}`);
      throw error;
    }

    return [];
  }
}

export function createLLMProvider(config: FactsConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
    default:
      return new AnthropicProvider(config);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/server/src/llm`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/llm.ts packages/server/src/llm.spec.ts
git commit -m "feat(server): add LLM provider abstraction for Anthropic and OpenAI"
```

---

## Task 6: Create Facts API Router

**Files:**
- Create: `packages/server/src/facts.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Create facts router**

Create `packages/server/src/facts.ts`:

```typescript
import { Router } from 'express';
import type { FactsRequest, FactsResponse, FactsTestResponse } from '@roon-screen-cover/shared';
import { FactsConfigStore } from './factsConfig.js';
import { FactsCache } from './factsCache.js';
import { createLLMProvider } from './llm.js';
import { logger } from './logger.js';

export function createFactsRouter(): Router {
  const router = Router();
  const configStore = new FactsConfigStore();
  const cache = new FactsCache();

  // Get facts for a track
  router.post('/facts', async (req, res) => {
    const { artist, album, title } = req.body as FactsRequest;

    if (!artist || !album || !title) {
      res.status(400).json({ error: 'artist, album, and title are required' });
      return;
    }

    const config = configStore.get();

    if (!config.apiKey) {
      res.status(503).json({
        error: { type: 'no-key', message: 'No API key configured' },
      });
      return;
    }

    // Check cache first
    const cached = cache.get(artist, album, title);
    if (cached) {
      const timestamp = cache.getTimestamp(artist, album, title);
      const response: FactsResponse = {
        facts: cached,
        cached: true,
        generatedAt: timestamp || Date.now(),
      };
      res.json(response);
      return;
    }

    // Generate new facts
    try {
      const provider = createLLMProvider(config);
      const facts = await provider.generateFacts(artist, album, title);

      if (facts.length === 0) {
        res.status(200).json({
          error: { type: 'empty', message: 'No facts generated' },
        });
        return;
      }

      // Cache the result
      cache.set(artist, album, title, facts);

      const response: FactsResponse = {
        facts,
        cached: false,
        generatedAt: Date.now(),
      };
      res.json(response);
    } catch (error) {
      logger.error(`Failed to generate facts: ${error}`);
      res.status(500).json({
        error: { type: 'api-error', message: 'Failed to generate facts' },
      });
    }
  });

  // Get facts configuration
  router.get('/facts/config', (_req, res) => {
    const config = configStore.get();
    // Don't expose full API key
    res.json({
      ...config,
      apiKey: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : '',
      hasApiKey: !!config.apiKey,
    });
  });

  // Update facts configuration
  router.post('/facts/config', (req, res) => {
    const updates = req.body as Partial<{
      provider: string;
      model: string;
      apiKey: string;
      factsCount: number;
      rotationInterval: number;
      prompt: string;
    }>;

    configStore.update(updates);
    logger.info('Facts config updated');
    res.json({ success: true });
  });

  // Test facts generation
  router.post('/facts/test', async (req, res) => {
    const { artist, album, title } = req.body as FactsRequest;

    if (!artist || !album || !title) {
      res.status(400).json({ error: 'artist, album, and title are required' });
      return;
    }

    const config = configStore.get();

    if (!config.apiKey) {
      res.status(400).json({ error: 'No API key configured' });
      return;
    }

    const startTime = Date.now();

    try {
      const provider = createLLMProvider(config);
      const facts = await provider.generateFacts(artist, album, title);
      const durationMs = Date.now() - startTime;

      const response: FactsTestResponse = { facts, durationMs };
      res.json(response);
    } catch (error) {
      logger.error(`Facts test failed: ${error}`);
      res.status(500).json({ error: `API error: ${error}` });
    }
  });

  return router;
}
```

**Step 2: Register router in server index**

Add import to `packages/server/src/index.ts`:
```typescript
import { createFactsRouter } from './facts.js';
```

Add route after other API routes (after line ~42):
```typescript
app.use('/api', createFactsRouter());
```

**Step 3: Verify server starts**

Run: `cd packages/server && pnpm build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add packages/server/src/facts.ts packages/server/src/index.ts
git commit -m "feat(server): add facts API router with caching and LLM integration"
```

---

## Task 7: Update Environment Example

**Files:**
- Modify: `.env.example`

**Step 1: Add LLM API key examples**

Add to `.env.example`:

```
# LLM API Keys for Facts Layout (optional - can also configure in Admin UI)
# Anthropic API key from console.anthropic.com
ANTHROPIC_API_KEY=

# OpenAI API key from platform.openai.com
OPENAI_API_KEY=
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add LLM API key configuration to .env.example"
```

---

## Task 8: Create useFacts Composable

**Files:**
- Create: `packages/client/src/composables/useFacts.ts`
- Create: `packages/client/src/composables/useFacts.spec.ts`

**Step 1: Write failing test**

Create `packages/client/src/composables/useFacts.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useFacts } from './useFacts';
import type { Track, PlaybackState } from '@roon-screen-cover/shared';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sessionStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
});

describe('useFacts', () => {
  const mockTrack: Track = {
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    duration_seconds: 180,
    artwork_key: 'abc123',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with empty facts and loading false', () => {
    const track = ref<Track | null>(null);
    const state = ref<PlaybackState>('stopped');
    const { facts, isLoading } = useFacts(track, state);

    expect(facts.value).toEqual([]);
    expect(isLoading.value).toBe(false);
  });

  it('should fetch facts when track changes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        facts: ['Fact 1', 'Fact 2'],
        cached: false,
        generatedAt: Date.now(),
      }),
    });

    const track = ref<Track | null>(null);
    const state = ref<PlaybackState>('playing');
    const { facts, isLoading } = useFacts(track, state);

    track.value = mockTrack;

    // Advance past debounce
    vi.advanceTimersByTime(600);
    await nextTick();

    expect(mockFetch).toHaveBeenCalledWith('/api/facts', expect.any(Object));
  });

  it('should debounce rapid track changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ facts: ['Fact'], cached: false, generatedAt: Date.now() }),
    });

    const track = ref<Track | null>(null);
    const state = ref<PlaybackState>('playing');
    useFacts(track, state);

    // Rapid track changes
    track.value = { ...mockTrack, title: 'Song 1' };
    vi.advanceTimersByTime(100);
    track.value = { ...mockTrack, title: 'Song 2' };
    vi.advanceTimersByTime(100);
    track.value = { ...mockTrack, title: 'Song 3' };
    vi.advanceTimersByTime(600);
    await nextTick();

    // Should only fetch once for the last track
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should set error when API returns error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: { type: 'no-key', message: 'No API key' } }),
    });

    const track = ref<Track | null>(mockTrack);
    const state = ref<PlaybackState>('playing');
    const { error } = useFacts(track, state);

    vi.advanceTimersByTime(600);
    await nextTick();
    await nextTick(); // Wait for async fetch

    expect(error.value?.type).toBe('no-key');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/client/src/composables/useFacts`
Expected: FAIL - Cannot find module './useFacts'

**Step 3: Implement useFacts composable**

Create `packages/client/src/composables/useFacts.ts`:

```typescript
import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { Track, PlaybackState, FactsResponse, FactsError } from '@roon-screen-cover/shared';

const DEBOUNCE_MS = 500;
const MIN_DISPLAY_TIME = 8000;
const MAX_DISPLAY_TIME = 30000;
const WORDS_PER_MS = 250; // Average reading speed
const PADDING_MS = 3000;

function calculateDisplayTime(fact: string): number {
  const wordCount = fact.split(/\s+/).length;
  const readingTime = wordCount * WORDS_PER_MS;
  const totalTime = readingTime + PADDING_MS;
  return Math.max(MIN_DISPLAY_TIME, Math.min(MAX_DISPLAY_TIME, totalTime));
}

function getSessionCacheKey(artist: string, album: string, title: string): string {
  return `facts::${artist.toLowerCase()}::${album.toLowerCase()}::${title.toLowerCase()}`;
}

export function useFacts(
  track: Ref<Track | null>,
  state: Ref<PlaybackState>
): {
  facts: Ref<string[]>;
  currentFactIndex: Ref<number>;
  currentFact: ComputedRef<string | null>;
  isLoading: Ref<boolean>;
  error: Ref<FactsError | null>;
  cached: Ref<boolean>;
} {
  const facts = ref<string[]>([]);
  const currentFactIndex = ref(0);
  const isLoading = ref(false);
  const error = ref<FactsError | null>(null);
  const cached = ref(false);

  let debounceTimer: number | null = null;
  let rotationTimer: number | null = null;

  const currentFact = computed(() => {
    if (facts.value.length === 0) return null;
    return facts.value[currentFactIndex.value] || null;
  });

  function clearTimers(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (rotationTimer) {
      clearTimeout(rotationTimer);
      rotationTimer = null;
    }
  }

  function scheduleNextFact(): void {
    if (rotationTimer) {
      clearTimeout(rotationTimer);
    }

    if (facts.value.length === 0 || state.value !== 'playing') {
      return;
    }

    const current = facts.value[currentFactIndex.value];
    if (!current) return;

    const displayTime = calculateDisplayTime(current);

    rotationTimer = window.setTimeout(() => {
      currentFactIndex.value = (currentFactIndex.value + 1) % facts.value.length;
      scheduleNextFact();
    }, displayTime);
  }

  async function fetchFacts(t: Track): Promise<void> {
    const cacheKey = getSessionCacheKey(t.artist, t.album, t.title);

    // Check session cache
    try {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData) as FactsResponse;
        facts.value = parsed.facts;
        cached.value = true;
        currentFactIndex.value = 0;
        scheduleNextFact();
        return;
      }
    } catch {
      // Ignore cache errors
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: t.artist,
          album: t.album,
          title: t.title,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        error.value = data.error || { type: 'api-error', message: 'Request failed' };
        facts.value = [];
        return;
      }

      const factsData = data as FactsResponse;
      facts.value = factsData.facts;
      cached.value = factsData.cached;
      currentFactIndex.value = 0;

      // Store in session cache
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(factsData));
      } catch {
        // Ignore storage errors
      }

      scheduleNextFact();
    } catch (err) {
      error.value = { type: 'api-error', message: 'Network error' };
      facts.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  // Watch for track changes with debounce
  watch(
    track,
    (newTrack, oldTrack) => {
      clearTimers();
      facts.value = [];
      currentFactIndex.value = 0;
      error.value = null;

      if (!newTrack) return;

      // Check if it's actually a different track
      if (
        oldTrack &&
        newTrack.title === oldTrack.title &&
        newTrack.artist === oldTrack.artist &&
        newTrack.album === oldTrack.album
      ) {
        return;
      }

      debounceTimer = window.setTimeout(() => {
        fetchFacts(newTrack);
      }, DEBOUNCE_MS);
    },
    { immediate: true }
  );

  // Watch play state for rotation control
  watch(state, (newState) => {
    if (newState === 'playing' && facts.value.length > 0) {
      scheduleNextFact();
    } else if (rotationTimer) {
      clearTimeout(rotationTimer);
      rotationTimer = null;
    }
  });

  onUnmounted(() => {
    clearTimers();
  });

  return {
    facts,
    currentFactIndex,
    currentFact,
    isLoading,
    error,
    cached,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/client/src/composables/useFacts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/composables/useFacts.ts packages/client/src/composables/useFacts.spec.ts
git commit -m "feat(client): add useFacts composable with caching and auto-rotation"
```

---

## Task 9: Create FactsColumnsLayout Component

**Files:**
- Create: `packages/client/src/layouts/FactsColumnsLayout.vue`

**Step 1: Create the component**

Create `packages/client/src/layouts/FactsColumnsLayout.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import { useColorExtraction } from '../composables/useColorExtraction';
import { useFacts } from '../composables/useFacts';
import ProgressBar from '../components/ProgressBar.vue';

const props = defineProps<{
  track: Track | null;
  state: PlaybackState;
  isPlaying: boolean;
  progress: number;
  currentTime: string;
  duration: string;
  artworkUrl: string | null;
  zoneName: string;
  background: BackgroundType;
}>();

const trackRef = computed(() => props.track);
const stateRef = computed(() => props.state);
const artworkUrlRef = computed(() => props.artworkUrl);

const { colors, isTransitioning } = useColorExtraction(artworkUrlRef);
const { facts, currentFactIndex, currentFact, isLoading, error } = useFacts(trackRef, stateRef);

// Track previous artwork for crossfade
const displayedArtwork = ref<string | null>(null);
const previousArtwork = ref<string | null>(null);
const artworkTransitioning = ref(false);

watch(
  () => props.artworkUrl,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      previousArtwork.value = displayedArtwork.value;
      displayedArtwork.value = newUrl;
      artworkTransitioning.value = true;
      setTimeout(() => {
        artworkTransitioning.value = false;
        previousArtwork.value = null;
      }, 500);
    }
  },
  { immediate: true }
);

const useDynamicColors = computed(() =>
  ['dominant', 'gradient-radial', 'gradient-linear'].includes(props.background)
);

const backgroundStyle = computed(() => {
  if (!useDynamicColors.value) {
    const bg = props.background === 'white' ? '#ffffff' : '#000000';
    return { '--bg-color': bg, '--bg-edge': bg };
  }

  if (props.background === 'gradient-radial') {
    return {
      '--bg-color': colors.value.background,
      '--bg-edge': colors.value.backgroundEdge,
      '--shadow-color': colors.value.shadow,
      '--text-color': colors.value.text,
      '--text-secondary': colors.value.textSecondary,
      '--text-tertiary': colors.value.textTertiary,
    };
  }

  return {
    '--bg-color': colors.value.background,
    '--bg-edge': colors.value.background,
    '--shadow-color': colors.value.shadow,
    '--text-color': colors.value.text,
    '--text-secondary': colors.value.textSecondary,
    '--text-tertiary': colors.value.textTertiary,
  };
});

const textColorClass = computed(() => {
  if (useDynamicColors.value) return '';
  return props.background === 'white' ? 'text-dark' : 'text-light';
});
</script>

<template>
  <div
    class="facts-columns-layout"
    :class="[{ transitioning: isTransitioning }, textColorClass]"
    :style="backgroundStyle"
  >
    <div class="safe-zone">
      <div class="content">
        <!-- Left column: Artwork -->
        <div class="artwork-column">
          <div class="artwork-wrapper">
            <img
              v-if="previousArtwork && artworkTransitioning"
              :src="previousArtwork"
              alt=""
              class="artwork artwork-previous"
            />
            <img
              v-if="displayedArtwork"
              :src="displayedArtwork"
              :alt="track?.album || 'Album artwork'"
              class="artwork"
              :class="{ 'artwork-entering': artworkTransitioning }"
            />
            <div v-else class="artwork-placeholder">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- Right column: Facts -->
        <div class="facts-column">
          <!-- Loading / Track Info State -->
          <div v-if="!currentFact || isLoading" class="track-info">
            <h1 v-if="track" class="title">{{ track.title }}</h1>
            <p v-if="track" class="artist">{{ track.artist }}</p>
            <p v-if="track" class="album">{{ track.album }}</p>
            <p v-if="isLoading" class="loading-hint">Loading facts...</p>
            <div v-if="!track" class="no-playback">
              <p class="no-playback-text">No playback</p>
              <p class="zone-hint">{{ zoneName }}</p>
            </div>
          </div>

          <!-- Facts Display -->
          <div v-else class="facts-display">
            <p class="fact-text">{{ currentFact }}</p>

            <!-- Dot indicators -->
            <div class="fact-dots">
              <span
                v-for="(_, index) in facts"
                :key="index"
                class="dot"
                :class="{ active: index === currentFactIndex }"
              />
            </div>
          </div>

          <!-- Error State -->
          <div v-if="error && !isLoading" class="error-state">
            <p v-if="error.type === 'no-key'" class="error-message">
              Configure API key in <a href="/admin">Admin Panel</a>
            </p>
            <p v-else class="error-message">{{ error.message }}</p>
          </div>

          <!-- Progress bar -->
          <div v-if="track" class="progress-container">
            <ProgressBar
              :progress="progress"
              :current-time="currentTime"
              :duration="duration"
              :show-time="true"
            />
          </div>

          <!-- Zone indicator -->
          <div class="zone-indicator">
            <span class="zone-name">{{ zoneName }}</span>
            <span v-if="isPlaying" class="playing-indicator">
              <span class="bar"></span>
              <span class="bar"></span>
              <span class="bar"></span>
            </span>
            <span v-else-if="state === 'paused'" class="paused-indicator">⏸</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.facts-columns-layout {
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse 120% 100% at 30% 50%,
    var(--bg-color, #000) 0%,
    var(--bg-edge, #000) 100%
  );
  color: var(--text-color, #fff);
  transition: background 0.5s ease-out;
  overflow: hidden;
}

.text-light {
  --text-color: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.8);
  --text-tertiary: rgba(255, 255, 255, 0.6);
}

.text-dark {
  --text-color: #000000;
  --text-secondary: rgba(0, 0, 0, 0.7);
  --text-tertiary: rgba(0, 0, 0, 0.5);
}

.safe-zone {
  width: 100%;
  height: 100%;
  padding: 5%;
  box-sizing: border-box;
}

.content {
  width: 100%;
  height: 100%;
  padding: 2.5%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (min-width: 900px) {
  .content {
    flex-direction: row;
    align-items: center;
    gap: 5%;
  }
}

.artwork-column {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 45vh;
}

@media (min-width: 900px) {
  .artwork-column {
    width: 55%;
    max-width: none;
    flex: 0 0 55%;
  }
}

.artwork-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 30px var(--shadow-color, rgba(0,0,0,0.3));
}

.artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.5s ease-out;
}

.artwork-previous {
  position: absolute;
  inset: 0;
  z-index: 1;
  animation: fadeOut 0.5s ease-out forwards;
}

.artwork-entering {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-edge, #1a1a1a);
  color: var(--text-tertiary);
}

.artwork-placeholder svg {
  width: 30%;
  height: 30%;
  opacity: 0.5;
}

.facts-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding-right: 2.5%;
}

@media (min-width: 900px) {
  .facts-column {
    flex: 0 0 40%;
  }
}

.track-info,
.facts-display {
  margin-bottom: 2rem;
}

.title {
  font-size: clamp(28px, 4.5vw, 56px);
  font-weight: 600;
  line-height: 1.15;
  margin: 0 0 0.4em 0;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.artist {
  font-size: clamp(20px, 3vw, 40px);
  font-weight: 400;
  line-height: 1.2;
  margin: 0 0 0.2em 0;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album {
  font-size: clamp(16px, 2vw, 28px);
  font-weight: 400;
  line-height: 1.3;
  margin: 0;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-hint {
  font-size: clamp(14px, 1.5vw, 20px);
  color: var(--text-tertiary);
  margin-top: 1rem;
}

.fact-text {
  font-size: clamp(18px, 2.5vw, 32px);
  font-weight: 400;
  line-height: 1.5;
  margin: 0;
  color: var(--text-color);
  animation: fadeIn 0.5s ease-out;
}

.fact-dots {
  display: flex;
  gap: 8px;
  margin-top: 1.5rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: background 0.3s, transform 0.3s;
}

.dot.active {
  background: var(--text-color);
  transform: scale(1.2);
}

.error-state {
  margin-bottom: 2rem;
}

.error-message {
  font-size: clamp(14px, 1.5vw, 18px);
  color: var(--text-tertiary);
  margin: 0;
}

.error-message a {
  color: var(--text-secondary);
  text-decoration: underline;
}

.progress-container {
  margin-bottom: 2rem;
}

.zone-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-tertiary);
  font-size: clamp(14px, 1.5vw, 20px);
}

.zone-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playing-indicator {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 18px;
}

.playing-indicator .bar {
  width: 4px;
  background: currentColor;
  border-radius: 2px;
  animation: equalizer 0.8s ease-in-out infinite;
  opacity: 0.8;
}

.playing-indicator .bar:nth-child(1) {
  height: 40%;
  animation-delay: 0s;
}

.playing-indicator .bar:nth-child(2) {
  height: 100%;
  animation-delay: 0.2s;
}

.playing-indicator .bar:nth-child(3) {
  height: 60%;
  animation-delay: 0.4s;
}

@keyframes equalizer {
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}

.paused-indicator {
  font-size: 1em;
  opacity: 0.8;
}

.no-playback {
  text-align: left;
}

.no-playback-text {
  font-size: clamp(24px, 3vw, 48px);
  color: var(--text-tertiary);
  margin: 0;
}

.zone-hint {
  font-size: clamp(16px, 2vw, 28px);
  color: var(--text-tertiary);
  margin: 0.5em 0 0 0;
  opacity: 0.7;
}

@media (max-width: 899px) {
  .content {
    justify-content: center;
  }

  .facts-column {
    text-align: center;
    padding-right: 0;
  }

  .fact-dots {
    justify-content: center;
  }

  .zone-indicator {
    justify-content: center;
  }

  .no-playback {
    text-align: center;
  }
}
</style>
```

**Step 2: Commit**

```bash
git add packages/client/src/layouts/FactsColumnsLayout.vue
git commit -m "feat(client): add FactsColumnsLayout component"
```

---

## Task 10: Create FactsOverlayLayout Component

**Files:**
- Create: `packages/client/src/layouts/FactsOverlayLayout.vue`

**Step 1: Create the component**

Create `packages/client/src/layouts/FactsOverlayLayout.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import { useFacts } from '../composables/useFacts';

const props = defineProps<{
  track: Track | null;
  state: PlaybackState;
  isPlaying: boolean;
  progress: number;
  currentTime: string;
  duration: string;
  artworkUrl: string | null;
  zoneName: string;
  background: BackgroundType;
}>();

const trackRef = computed(() => props.track);
const stateRef = computed(() => props.state);

const { facts, currentFactIndex, currentFact, isLoading, error } = useFacts(trackRef, stateRef);

// Track previous artwork for crossfade
const displayedArtwork = ref<string | null>(null);
const previousArtwork = ref<string | null>(null);
const artworkTransitioning = ref(false);

watch(
  () => props.artworkUrl,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      previousArtwork.value = displayedArtwork.value;
      displayedArtwork.value = newUrl;
      artworkTransitioning.value = true;
      setTimeout(() => {
        artworkTransitioning.value = false;
        previousArtwork.value = null;
      }, 500);
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="facts-overlay-layout">
    <!-- Full artwork background -->
    <div class="artwork-background">
      <img
        v-if="previousArtwork && artworkTransitioning"
        :src="previousArtwork"
        alt=""
        class="artwork artwork-previous"
      />
      <img
        v-if="displayedArtwork"
        :src="displayedArtwork"
        :alt="track?.album || 'Album artwork'"
        class="artwork"
        :class="{ 'artwork-entering': artworkTransitioning }"
      />
      <div v-else class="artwork-placeholder" />
    </div>

    <!-- Gradient overlay -->
    <div class="gradient-overlay" />

    <!-- Content overlay -->
    <div class="content-overlay">
      <div class="safe-zone">
        <!-- Track info or fact -->
        <div class="text-content">
          <template v-if="!currentFact || isLoading">
            <h1 v-if="track" class="title">{{ track.title }}</h1>
            <p v-if="track" class="artist">{{ track.artist }}</p>
            <p v-if="isLoading" class="loading-hint">Loading facts...</p>
          </template>

          <template v-else>
            <p class="fact-text">{{ currentFact }}</p>
            <div class="fact-dots">
              <span
                v-for="(_, index) in facts"
                :key="index"
                class="dot"
                :class="{ active: index === currentFactIndex }"
              />
            </div>
          </template>

          <p v-if="error && error.type === 'no-key'" class="error-hint">
            Configure API key in <a href="/admin">Admin</a>
          </p>

          <div v-if="!track" class="no-playback">
            <p class="no-playback-text">No playback</p>
            <p class="zone-hint">{{ zoneName }}</p>
          </div>
        </div>

        <!-- Progress line -->
        <div v-if="track" class="progress-line">
          <div class="progress-fill" :style="{ width: `${progress}%` }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.facts-overlay-layout {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.artwork-background {
  position: absolute;
  inset: 0;
}

.artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.5s ease-out;
}

.artwork-previous {
  position: absolute;
  inset: 0;
  z-index: 1;
  animation: fadeOut 0.5s ease-out forwards;
}

.artwork-entering {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.artwork-placeholder {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
}

.gradient-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.7) 20%,
    rgba(0, 0, 0, 0.3) 40%,
    transparent 60%
  );
  pointer-events: none;
}

.content-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.safe-zone {
  padding: 5% 7.5%;
}

.text-content {
  margin-bottom: 1.5rem;
}

.title {
  font-size: clamp(32px, 5vw, 64px);
  font-weight: 600;
  line-height: 1.1;
  margin: 0 0 0.3em 0;
  color: #fff;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.artist {
  font-size: clamp(20px, 3vw, 40px);
  font-weight: 400;
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.loading-hint {
  font-size: clamp(14px, 1.5vw, 20px);
  color: rgba(255, 255, 255, 0.6);
  margin: 1rem 0 0 0;
}

.fact-text {
  font-size: clamp(20px, 3vw, 36px);
  font-weight: 400;
  line-height: 1.4;
  margin: 0;
  color: #fff;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
  max-width: 80%;
  animation: fadeIn 0.5s ease-out;
}

.fact-dots {
  display: flex;
  gap: 8px;
  margin-top: 1rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  transition: background 0.3s, transform 0.3s;
}

.dot.active {
  background: #fff;
  transform: scale(1.2);
}

.error-hint {
  font-size: clamp(12px, 1.2vw, 16px);
  color: rgba(255, 255, 255, 0.5);
  margin: 1rem 0 0 0;
}

.error-hint a {
  color: rgba(255, 255, 255, 0.7);
}

.no-playback {
  color: rgba(255, 255, 255, 0.6);
}

.no-playback-text {
  font-size: clamp(24px, 3vw, 48px);
  margin: 0;
}

.zone-hint {
  font-size: clamp(16px, 2vw, 28px);
  margin: 0.5em 0 0 0;
  opacity: 0.7;
}

.progress-line {
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 1.5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  transition: width 0.1s linear;
}

@media (max-width: 899px) {
  .fact-text {
    max-width: 100%;
  }
}
</style>
```

**Step 2: Commit**

```bash
git add packages/client/src/layouts/FactsOverlayLayout.vue
git commit -m "feat(client): add FactsOverlayLayout component"
```

---

## Task 11: Create FactsCarouselLayout Component

**Files:**
- Create: `packages/client/src/layouts/FactsCarouselLayout.vue`

**Step 1: Create the component**

Create `packages/client/src/layouts/FactsCarouselLayout.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import { useFacts } from '../composables/useFacts';

const props = defineProps<{
  track: Track | null;
  state: PlaybackState;
  isPlaying: boolean;
  progress: number;
  currentTime: string;
  duration: string;
  artworkUrl: string | null;
  zoneName: string;
  background: BackgroundType;
}>();

const trackRef = computed(() => props.track);
const stateRef = computed(() => props.state);

const { facts, currentFactIndex, currentFact, isLoading, error } = useFacts(trackRef, stateRef);

// Track previous artwork for crossfade
const displayedArtwork = ref<string | null>(null);
const previousArtwork = ref<string | null>(null);
const artworkTransitioning = ref(false);

watch(
  () => props.artworkUrl,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      previousArtwork.value = displayedArtwork.value;
      displayedArtwork.value = newUrl;
      artworkTransitioning.value = true;
      setTimeout(() => {
        artworkTransitioning.value = false;
        previousArtwork.value = null;
      }, 500);
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="facts-carousel-layout">
    <!-- Blurred artwork background -->
    <div class="artwork-background">
      <img
        v-if="previousArtwork && artworkTransitioning"
        :src="previousArtwork"
        alt=""
        class="bg-artwork bg-artwork-previous"
      />
      <img
        v-if="displayedArtwork"
        :src="displayedArtwork"
        alt=""
        class="bg-artwork"
        :class="{ 'bg-artwork-entering': artworkTransitioning }"
      />
      <div v-else class="bg-placeholder" />
    </div>

    <!-- Dark overlay -->
    <div class="dark-overlay" />

    <!-- Content -->
    <div class="content">
      <div class="safe-zone">
        <!-- Fact card -->
        <div class="fact-card">
          <template v-if="!currentFact || isLoading">
            <h1 v-if="track" class="title">{{ track.title }}</h1>
            <p v-if="track" class="artist">{{ track.artist }}</p>
            <p v-if="track" class="album">{{ track.album }}</p>
            <p v-if="isLoading" class="loading-hint">Loading facts...</p>
          </template>

          <template v-else>
            <p class="fact-text">{{ currentFact }}</p>
          </template>

          <p v-if="error && error.type === 'no-key'" class="error-hint">
            Configure API key in <a href="/admin">Admin</a>
          </p>

          <div v-if="!track" class="no-playback">
            <p class="no-playback-text">No playback</p>
            <p class="zone-hint">{{ zoneName }}</p>
          </div>

          <!-- Dot indicators inside card -->
          <div v-if="facts.length > 0 && currentFact" class="fact-dots">
            <span
              v-for="(_, index) in facts"
              :key="index"
              class="dot"
              :class="{ active: index === currentFactIndex }"
            />
          </div>
        </div>

        <!-- Bottom info -->
        <div class="bottom-info">
          <div class="track-meta">
            <span v-if="track" class="meta-text">
              {{ track.title }} · {{ track.artist }}
            </span>
          </div>
          <div class="time-info">
            <span>{{ currentTime }}</span>
            <span class="separator">/</span>
            <span>{{ duration }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.facts-carousel-layout {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.artwork-background {
  position: absolute;
  inset: -20px; /* Extend beyond edges for blur */
}

.bg-artwork {
  width: calc(100% + 40px);
  height: calc(100% + 40px);
  object-fit: cover;
  filter: blur(30px) brightness(0.6);
  transform: scale(1.1);
  transition: opacity 0.5s ease-out;
}

.bg-artwork-previous {
  position: absolute;
  inset: 0;
  z-index: 1;
  animation: fadeOut 0.5s ease-out forwards;
}

.bg-artwork-entering {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.bg-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.dark-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
}

.content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.safe-zone {
  width: 100%;
  height: 100%;
  padding: 5%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.fact-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: clamp(24px, 4vw, 48px);
  max-width: 70%;
  min-width: 300px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: cardFadeIn 0.5s ease-out;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.title {
  font-size: clamp(24px, 4vw, 48px);
  font-weight: 600;
  line-height: 1.2;
  margin: 0 0 0.3em 0;
  color: #fff;
}

.artist {
  font-size: clamp(18px, 2.5vw, 32px);
  font-weight: 400;
  margin: 0 0 0.2em 0;
  color: rgba(255, 255, 255, 0.8);
}

.album {
  font-size: clamp(14px, 1.8vw, 24px);
  font-weight: 400;
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
}

.loading-hint {
  font-size: clamp(12px, 1.2vw, 18px);
  color: rgba(255, 255, 255, 0.5);
  margin: 1rem 0 0 0;
}

.fact-text {
  font-size: clamp(18px, 2.5vw, 32px);
  font-weight: 400;
  line-height: 1.5;
  margin: 0;
  color: #fff;
}

.fact-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 1.5rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: background 0.3s, transform 0.3s;
}

.dot.active {
  background: #fff;
  transform: scale(1.2);
}

.error-hint {
  font-size: clamp(12px, 1.2vw, 16px);
  color: rgba(255, 255, 255, 0.5);
  margin: 1rem 0 0 0;
}

.error-hint a {
  color: rgba(255, 255, 255, 0.7);
}

.no-playback {
  color: rgba(255, 255, 255, 0.6);
}

.no-playback-text {
  font-size: clamp(20px, 2.5vw, 36px);
  margin: 0;
}

.zone-hint {
  font-size: clamp(14px, 1.5vw, 22px);
  margin: 0.5em 0 0 0;
  opacity: 0.7;
}

.bottom-info {
  position: absolute;
  bottom: 5%;
  left: 5%;
  right: 5%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: clamp(12px, 1.2vw, 16px);
}

.meta-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.time-info {
  display: flex;
  gap: 0.3em;
}

.separator {
  opacity: 0.5;
}

@media (max-width: 899px) {
  .fact-card {
    max-width: 90%;
    min-width: unset;
  }
}
</style>
```

**Step 2: Commit**

```bash
git add packages/client/src/layouts/FactsCarouselLayout.vue
git commit -m "feat(client): add FactsCarouselLayout component"
```

---

## Task 12: Register Facts Layouts in NowPlaying

**Files:**
- Modify: `packages/client/src/components/NowPlaying.vue`

**Step 1: Import and register layouts**

Add imports after existing layout imports:
```typescript
import FactsColumnsLayout from '../layouts/FactsColumnsLayout.vue';
import FactsOverlayLayout from '../layouts/FactsOverlayLayout.vue';
import FactsCarouselLayout from '../layouts/FactsCarouselLayout.vue';
```

Update `layoutComponent` computed to include facts layouts:
```typescript
const layoutComponent = computed(() => {
  switch (props.layout) {
    case 'minimal':
      return MinimalLayout;
    case 'fullscreen':
      return FullscreenLayout;
    case 'ambient':
      return AmbientLayout;
    case 'cover':
      return CoverLayout;
    case 'facts-columns':
      return FactsColumnsLayout;
    case 'facts-overlay':
      return FactsOverlayLayout;
    case 'facts-carousel':
      return FactsCarouselLayout;
    default:
      return DetailedLayout;
  }
});
```

**Step 2: Verify build**

Run: `cd packages/client && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add packages/client/src/components/NowPlaying.vue
git commit -m "feat(client): register facts layouts in NowPlaying component"
```

---

## Task 13: Add Facts Configuration to Admin Panel

**Files:**
- Modify: `packages/client/src/views/AdminView.vue`

**Step 1: Add facts configuration section**

This is a larger modification. Add a new collapsible section after the clients table. The section should include:

1. Provider dropdown (Anthropic/OpenAI)
2. Model dropdown (dynamic based on provider)
3. API key input with show/hide toggle
4. Facts count number input
5. Rotation interval number input
6. Advanced toggle with prompt textarea
7. Test configuration panel
8. Save/Reset buttons

Due to the length, implement this in a separate subcomponent or inline. Key functionality:

- Fetch config from `GET /api/facts/config` on mount
- Save config via `POST /api/facts/config`
- Test via `POST /api/facts/test`

**Step 2: Verify the admin panel loads**

Run: `pnpm dev` and navigate to `/admin`
Expected: Facts configuration section visible

**Step 3: Commit**

```bash
git add packages/client/src/views/AdminView.vue
git commit -m "feat(client): add facts configuration section to admin panel"
```

---

## Task 14: Run Full Test Suite

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Fix any failing tests**

If tests fail related to LAYOUTS count, update the test expectations.

**Step 3: Build all packages**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit any test fixes**

```bash
git add -A
git commit -m "test: update test expectations for facts layouts"
```

---

## Task 15: Final Integration Test

**Step 1: Start development server**

Run: `pnpm dev`

**Step 2: Manual testing checklist**

- [ ] Navigate to `/` - should show now playing view
- [ ] Cycle through layouts - facts layouts should appear in rotation
- [ ] Navigate to `/admin` - should show facts configuration section
- [ ] Configure API key and test
- [ ] Select a facts layout and verify facts appear
- [ ] Verify facts rotate automatically
- [ ] Verify caching works (check Network tab)

**Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: complete facts layout implementation"
```

---

## Summary

This plan implements:

1. **Server-side** (Tasks 1-7):
   - LLM SDK dependencies
   - Shared types for facts
   - Config store with file persistence
   - Cache with 72h TTL and file persistence
   - LLM provider abstraction
   - Facts API router

2. **Client-side** (Tasks 8-13):
   - useFacts composable with auto-rotation
   - Three facts layout components
   - Layout registration
   - Admin panel configuration

3. **Testing** (Tasks 14-15):
   - Unit tests for new modules
   - Integration testing
