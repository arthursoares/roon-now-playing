# OpenRouter and Local LLM Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OpenRouter and Local LLM (Ollama/LM Studio) as new AI providers for facts generation, expanding access to 200+ models.

**Architecture:** Factory pattern with dedicated provider classes. Both new providers use OpenAI-compatible APIs. OpenRouter provides cloud-hosted models via unified gateway. Local LLM enables privacy-focused local inference with configurable base URL.

**Tech Stack:** TypeScript, Vue 3, native fetch API (no new dependencies needed)

---

## Task 1: Update Shared Type Definitions

**Files:**
- Modify: `packages/shared/src/index.ts:103-121`

**Step 1: Write the failing test**

```typescript
// Add to packages/shared/src/index.spec.ts

describe('LLM Provider Types', () => {
  it('should include openrouter in LLM_PROVIDERS', () => {
    expect(LLM_PROVIDERS).toContain('openrouter');
  });

  it('should include local in LLM_PROVIDERS', () => {
    expect(LLM_PROVIDERS).toContain('local');
  });

  it('should have openrouter models including custom option', () => {
    expect(LLM_MODELS.openrouter).toContain('meta-llama/llama-3.1-70b-instruct');
    expect(LLM_MODELS.openrouter).toContain('custom');
  });

  it('should have empty local models array', () => {
    expect(LLM_MODELS.local).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/shared/src/index.spec.ts --reporter=verbose`
Expected: FAIL with "'openrouter' is not in array"

**Step 3: Write minimal implementation**

Update `packages/shared/src/index.ts`:

```typescript
// LLM Provider options
export const LLM_PROVIDERS = ['anthropic', 'openai', 'openrouter', 'local'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

// Model options per provider
export const LLM_MODELS = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514'] as const,
  openai: ['gpt-4o', 'gpt-4o-mini'] as const,
  openrouter: [
    'meta-llama/llama-3.1-70b-instruct',
    'meta-llama/llama-3.1-8b-instruct',
    'mistralai/mistral-large',
    'mistralai/mistral-small',
    'google/gemini-pro-1.5',
    'google/gemini-flash-1.5',
    'deepseek/deepseek-chat',
    'custom',
  ] as const,
  local: [] as const,
} as const;

// Facts configuration (stored on server)
export interface FactsConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  factsCount: number;
  rotationInterval: number;
  prompt: string;
  localBaseUrl?: string; // Only used for 'local' provider
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/shared/src/index.spec.ts --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/index.spec.ts
git commit -m "$(cat <<'EOF'
feat(shared): add OpenRouter and Local LLM provider types

- Add 'openrouter' and 'local' to LLM_PROVIDERS
- Add curated OpenRouter models (Llama, Mistral, Gemini, DeepSeek)
- Add 'custom' option for user-defined OpenRouter models
- Add localBaseUrl field to FactsConfig for Local LLM
EOF
)"
```

---

## Task 2: Update Facts Config Store

**Files:**
- Modify: `packages/server/src/factsConfig.ts`

**Step 1: Write the failing test**

```typescript
// Add to packages/server/src/factsConfig.spec.ts

describe('FactsConfigStore - New Providers', () => {
  it('should return OpenRouter API key from environment', () => {
    process.env.OPENROUTER_API_KEY = 'or-test-key';
    const store = new FactsConfigStore(testConfigPath);
    store.update({ provider: 'openrouter' });

    const config = store.get();
    expect(config.apiKey).toBe('or-test-key');

    delete process.env.OPENROUTER_API_KEY;
  });

  it('should return localBaseUrl from environment for local provider', () => {
    process.env.LOCAL_LLM_URL = 'http://localhost:1234/v1';
    const store = new FactsConfigStore(testConfigPath);
    store.update({ provider: 'local' });

    const config = store.get();
    expect(config.localBaseUrl).toBe('http://localhost:1234/v1');

    delete process.env.LOCAL_LLM_URL;
  });

  it('should use default localBaseUrl when not configured', () => {
    const store = new FactsConfigStore(testConfigPath);
    store.update({ provider: 'local' });

    const config = store.get();
    expect(config.localBaseUrl).toBe('http://localhost:11434/v1');
  });

  it('should not require API key for local provider', () => {
    const store = new FactsConfigStore(testConfigPath);
    store.update({ provider: 'local', model: 'llama3.1', apiKey: '' });

    // hasApiKey should still return false, but that's OK for local
    expect(store.get().provider).toBe('local');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/server/src/factsConfig.spec.ts --reporter=verbose`
Expected: FAIL with "Expected 'or-test-key' but received ''"

**Step 3: Write minimal implementation**

Update `packages/server/src/factsConfig.ts`:

```typescript
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
        return this.config.apiKey; // Optional, no env var
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/server/src/factsConfig.spec.ts --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/factsConfig.ts packages/server/src/factsConfig.spec.ts
git commit -m "$(cat <<'EOF'
feat(server): add OpenRouter and Local LLM config support

- Add OPENROUTER_API_KEY env var support
- Add LOCAL_LLM_URL env var for custom base URL
- Default local base URL to Ollama (localhost:11434/v1)
- Refactor API key resolution into getEffectiveApiKey()
EOF
)"
```

---

## Task 3: Implement OpenRouterProvider

**Files:**
- Modify: `packages/server/src/llm.ts`

**Step 1: Write the failing test**

```typescript
// Add to packages/server/src/llm.spec.ts

// Add mock for global fetch at the top of the file
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('OpenRouterProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should be created by factory for openrouter provider', () => {
    const config = { ...baseConfig, provider: 'openrouter' as const };
    const provider = createLLMProvider(config);
    expect(provider).toBeInstanceOf(OpenRouterProvider);
  });

  it('should generate facts via OpenRouter API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["Fact from OpenRouter"]' } }],
      }),
    });

    const config = {
      ...baseConfig,
      provider: 'openrouter' as const,
      model: 'meta-llama/llama-3.1-70b-instruct',
    };
    const provider = new OpenRouterProvider(config);
    const facts = await provider.generateFacts('Artist', 'Album', 'Title');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': `Bearer ${config.apiKey}`,
          'HTTP-Referer': expect.any(String),
          'X-Title': 'Roon Now Playing',
        }),
      })
    );
    expect(facts).toEqual(['Fact from OpenRouter']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/server/src/llm.spec.ts --reporter=verbose`
Expected: FAIL with "OpenRouterProvider is not defined"

**Step 3: Write minimal implementation**

Add to `packages/server/src/llm.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { FactsConfig } from '@roon-screen-cover/shared';
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

export class OpenRouterProvider implements LLMProvider {
  private config: FactsConfig;

  constructor(config: FactsConfig) {
    this.config = config;
  }

  async generateFacts(artist: string, album: string, title: string): Promise<string[]> {
    const prompt = buildPrompt(this.config.prompt, {
      artist,
      album,
      title,
      factsCount: this.config.factsCount,
    });

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/arthursoares/roon-now-playing',
          'X-Title': 'Roon Now Playing',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return parseFactsResponse(content);
      }
    } catch (error) {
      logger.error(`OpenRouter API error: ${error}`);
      throw error;
    }

    return [];
  }
}

export function createLLMProvider(config: FactsConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'openrouter':
      return new OpenRouterProvider(config);
    case 'anthropic':
    default:
      return new AnthropicProvider(config);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/server/src/llm.spec.ts --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/llm.ts packages/server/src/llm.spec.ts
git commit -m "$(cat <<'EOF'
feat(server): add OpenRouterProvider for cloud LLM access

- Implement OpenRouterProvider using native fetch
- Add OpenRouter-specific headers (HTTP-Referer, X-Title)
- Update factory to create OpenRouterProvider
- Add tests with mocked fetch
EOF
)"
```

---

## Task 4: Implement LocalLLMProvider

**Files:**
- Modify: `packages/server/src/llm.ts`

**Step 1: Write the failing test**

```typescript
// Add to packages/server/src/llm.spec.ts

describe('LocalLLMProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should be created by factory for local provider', () => {
    const config = { ...baseConfig, provider: 'local' as const, localBaseUrl: 'http://localhost:11434/v1' };
    const provider = createLLMProvider(config);
    expect(provider).toBeInstanceOf(LocalLLMProvider);
  });

  it('should generate facts via Local LLM API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["Local fact"]' } }],
      }),
    });

    const config = {
      ...baseConfig,
      provider: 'local' as const,
      model: 'llama3.1',
      localBaseUrl: 'http://localhost:11434/v1',
      apiKey: '',
    };
    const provider = new LocalLLMProvider(config);
    const facts = await provider.generateFacts('Artist', 'Album', 'Title');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(facts).toEqual(['Local fact']);
  });

  it('should work without API key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["Fact"]' } }],
      }),
    });

    const config = {
      ...baseConfig,
      provider: 'local' as const,
      model: 'llama3.1',
      localBaseUrl: 'http://localhost:11434/v1',
      apiKey: '',
    };
    const provider = new LocalLLMProvider(config);
    await provider.generateFacts('Artist', 'Album', 'Title');

    // Verify no Authorization header when apiKey is empty
    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('should include Authorization header when API key provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["Fact"]' } }],
      }),
    });

    const config = {
      ...baseConfig,
      provider: 'local' as const,
      model: 'llama3.1',
      localBaseUrl: 'http://localhost:11434/v1',
      apiKey: 'local-secret',
    };
    const provider = new LocalLLMProvider(config);
    await provider.generateFacts('Artist', 'Album', 'Title');

    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer local-secret');
  });

  it('should use custom base URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '["Fact"]' } }],
      }),
    });

    const config = {
      ...baseConfig,
      provider: 'local' as const,
      model: 'mistral',
      localBaseUrl: 'http://localhost:1234/v1', // LM Studio port
      apiKey: '',
    };
    const provider = new LocalLLMProvider(config);
    await provider.generateFacts('Artist', 'Album', 'Title');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/chat/completions',
      expect.anything()
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/server/src/llm.spec.ts --reporter=verbose`
Expected: FAIL with "LocalLLMProvider is not defined"

**Step 3: Write minimal implementation**

Add `LocalLLMProvider` class to `packages/server/src/llm.ts`:

```typescript
export class LocalLLMProvider implements LLMProvider {
  private config: FactsConfig;

  constructor(config: FactsConfig) {
    this.config = config;
  }

  async generateFacts(artist: string, album: string, title: string): Promise<string[]> {
    const prompt = buildPrompt(this.config.prompt, {
      artist,
      album,
      title,
      factsCount: this.config.factsCount,
    });

    const baseUrl = this.config.localBaseUrl || 'http://localhost:11434/v1';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Local LLM API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return parseFactsResponse(content);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error(`Cannot connect to local LLM at ${baseUrl}. Is Ollama/LM Studio running?`);
      }
      logger.error(`Local LLM API error: ${error}`);
      throw error;
    }

    return [];
  }
}
```

Update the factory function:

```typescript
export function createLLMProvider(config: FactsConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'openrouter':
      return new OpenRouterProvider(config);
    case 'local':
      return new LocalLLMProvider(config);
    case 'anthropic':
    default:
      return new AnthropicProvider(config);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- packages/server/src/llm.spec.ts --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/llm.ts packages/server/src/llm.spec.ts
git commit -m "$(cat <<'EOF'
feat(server): add LocalLLMProvider for Ollama/LM Studio

- Implement LocalLLMProvider with configurable base URL
- Make API key optional for local providers
- Add friendly error message for connection failures
- Update factory to create LocalLLMProvider
EOF
)"
```

---

## Task 5: Update Environment Variables

**Files:**
- Modify: `.env.example`

**Step 1: Update .env.example**

```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0

# Artwork Cache
ARTWORK_CACHE_DIR=./cache

# Logging
LOG_LEVEL=info

# LLM API Keys (Optional - only needed for facts layouts)
# These keys enable AI-generated facts about albums, artists, and tracks
# during music playback. Leave empty if not using facts layouts.

# Anthropic Claude API Key
# Get your key at: https://console.anthropic.com/
ANTHROPIC_API_KEY=

# OpenAI GPT API Key
# Get your key at: https://platform.openai.com/api-keys
OPENAI_API_KEY=

# OpenRouter API Key (access to 200+ models)
# Get your key at: https://openrouter.ai/keys
OPENROUTER_API_KEY=

# Local LLM Configuration (Ollama/LM Studio)
# Default: http://localhost:11434/v1 (Ollama)
# LM Studio typically uses: http://localhost:1234/v1
LOCAL_LLM_URL=
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
docs: add OpenRouter and Local LLM env vars to .env.example

- Add OPENROUTER_API_KEY with link to key generation
- Add LOCAL_LLM_URL with defaults for Ollama and LM Studio
EOF
)"
```

---

## Task 6: Update Admin UI - Provider Dropdown

**Files:**
- Modify: `packages/client/src/views/AdminView.vue`

**Step 1: Update provider display names**

Find the provider dropdown (around line 663-668) and update:

```vue
<div class="form-field">
  <label for="provider">Provider</label>
  <select id="provider" v-model="factsConfig.provider" @change="onProviderChange">
    <option v-for="p in LLM_PROVIDERS" :key="p" :value="p">
      {{ getProviderDisplayName(p) }}
    </option>
  </select>
</div>
```

Add helper function in `<script setup>`:

```typescript
function getProviderDisplayName(provider: string): string {
  switch (provider) {
    case 'anthropic': return 'Anthropic (Claude)';
    case 'openai': return 'OpenAI (GPT)';
    case 'openrouter': return 'OpenRouter';
    case 'local': return 'Local LLM (Ollama/LM Studio)';
    default: return provider;
  }
}
```

**Step 2: Commit**

```bash
git add packages/client/src/views/AdminView.vue
git commit -m "$(cat <<'EOF'
feat(client): add OpenRouter and Local LLM to provider dropdown

- Add friendly display names for all providers
- OpenRouter and Local LLM now appear in Admin UI
EOF
)"
```

---

## Task 7: Update Admin UI - Model Selection

**Files:**
- Modify: `packages/client/src/views/AdminView.vue`

**Step 1: Add custom model state**

Add to the `<script setup>` section:

```typescript
const customModel = ref('');
const isCustomModel = computed(() =>
  factsConfig.value.provider === 'openrouter' &&
  !LLM_MODELS.openrouter.includes(factsConfig.value.model as any) &&
  factsConfig.value.model !== 'custom'
);
```

**Step 2: Update model field template**

Replace the model form-field (around line 670-677) with:

```vue
<div class="form-field">
  <label for="model">
    {{ factsConfig.provider === 'local' ? 'Model Name' : 'Model' }}
  </label>

  <!-- Local LLM: Free-form text input -->
  <template v-if="factsConfig.provider === 'local'">
    <input
      id="model"
      type="text"
      v-model="factsConfig.model"
      placeholder="e.g., llama3.1, mistral, codellama"
    />
  </template>

  <!-- OpenRouter: Dropdown with custom option -->
  <template v-else-if="factsConfig.provider === 'openrouter'">
    <select
      id="model"
      :value="isCustomModel ? 'custom' : factsConfig.model"
      @change="onOpenRouterModelChange"
    >
      <option v-for="m in availableModels" :key="m" :value="m">
        {{ m === 'custom' ? 'Custom...' : m }}
      </option>
    </select>

    <!-- Custom model input -->
    <input
      v-if="factsConfig.model === 'custom' || isCustomModel"
      type="text"
      v-model="factsConfig.model"
      placeholder="e.g., meta-llama/llama-3.1-70b-instruct"
      class="custom-model-input"
    />
  </template>

  <!-- Anthropic/OpenAI: Standard dropdown -->
  <template v-else>
    <select id="model" v-model="factsConfig.model">
      <option v-for="m in availableModels" :key="m" :value="m">
        {{ m }}
      </option>
    </select>
  </template>
</div>
```

**Step 3: Add handler function**

```typescript
function onOpenRouterModelChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value === 'custom') {
    factsConfig.value.model = '';
  } else {
    factsConfig.value.model = value;
  }
}
```

**Step 4: Add CSS for custom model input**

```css
.custom-model-input {
  margin-top: 8px;
}
```

**Step 5: Commit**

```bash
git add packages/client/src/views/AdminView.vue
git commit -m "$(cat <<'EOF'
feat(client): add dynamic model selection for new providers

- Local LLM: free-form text input for model name
- OpenRouter: dropdown with 'Custom...' option
- Custom model input appears when 'Custom...' selected
EOF
)"
```

---

## Task 8: Update Admin UI - Local Base URL Field

**Files:**
- Modify: `packages/client/src/views/AdminView.vue`

**Step 1: Update factsConfig ref to include localBaseUrl**

```typescript
const factsConfig = ref<FactsConfig>({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: '',
  factsCount: 5,
  rotationInterval: 25,
  prompt: DEFAULT_FACTS_PROMPT,
  localBaseUrl: 'http://localhost:11434/v1',
});
```

**Step 2: Add base URL field after API key field**

Insert after the API Key form-field (around line 704):

```vue
<!-- Local LLM Base URL -->
<div v-if="factsConfig.provider === 'local'" class="form-field full-width">
  <label for="localBaseUrl">
    Base URL
    <span class="label-hint">Default: Ollama on localhost:11434</span>
  </label>
  <input
    id="localBaseUrl"
    type="text"
    v-model="factsConfig.localBaseUrl"
    placeholder="http://localhost:11434/v1"
    class="mono-input"
  />
</div>
```

**Step 3: Update API key label for local provider**

Update the API key field to show helper text for local provider:

```vue
<div class="form-field full-width">
  <label for="apiKey">
    API Key
    <span class="label-hint">
      {{ factsConfig.provider === 'local'
        ? 'Optional - only if your local server requires auth'
        : 'Leave empty to use environment variable' }}
    </span>
  </label>
  <!-- ... rest of field ... -->
</div>
```

**Step 4: Update resetFactsConfig**

```typescript
function resetFactsConfig(): void {
  factsConfig.value = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: '',
    factsCount: 5,
    rotationInterval: 25,
    prompt: DEFAULT_FACTS_PROMPT,
    localBaseUrl: 'http://localhost:11434/v1',
  };
}
```

**Step 5: Commit**

```bash
git add packages/client/src/views/AdminView.vue
git commit -m "$(cat <<'EOF'
feat(client): add Local LLM base URL configuration

- Show base URL field when Local LLM provider selected
- Update API key hint for local provider (optional)
- Include localBaseUrl in reset defaults
EOF
)"
```

---

## Task 9: Update README Documentation

**Files:**
- Modify: `README.md`

**Step 1: Update the Features list**

Add after "AI-generated facts about currently playing music (Anthropic/OpenAI)":

```markdown
- AI-generated facts about currently playing music (Anthropic/OpenAI/OpenRouter/Local LLM)
```

**Step 2: Update Facts Configuration section**

Replace the existing text under "### Facts Configuration":

```markdown
### Facts Configuration
Configure AI-powered facts generation for the facts layouts:
- Choose between Anthropic (Claude), OpenAI, OpenRouter, or Local LLM providers
- **OpenRouter**: Access 200+ models (Llama, Mistral, Gemini, DeepSeek, etc.) with a single API key
- **Local LLM**: Run models locally with Ollama or LM Studio for privacy and offline use
- Select model or enter custom model ID (OpenRouter/Local)
- Set API key (or use environment variables)
- Configure facts count per track (1-10)
- Customize rotation interval
- Test configuration with sample track data
```

**Step 3: Update Configuration table**

Add new rows:

```markdown
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `ARTWORK_CACHE_DIR` | `./cache` | Artwork cache directory |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `ANTHROPIC_API_KEY` | - | Anthropic API key for facts generation |
| `OPENAI_API_KEY` | - | OpenAI API key for facts generation |
| `OPENROUTER_API_KEY` | - | OpenRouter API key (access to 200+ models) |
| `LOCAL_LLM_URL` | `http://localhost:11434/v1` | Local LLM base URL (Ollama/LM Studio) |
```

**Step 4: Add new section for LLM Providers**

Add after the Configuration section:

```markdown
## LLM Providers

The facts layouts support multiple AI providers for generating music facts:

### Anthropic (Claude)
- Models: `claude-sonnet-4-20250514`, `claude-haiku-4-20250514`
- Get API key: https://console.anthropic.com/

### OpenAI
- Models: `gpt-4o`, `gpt-4o-mini`
- Get API key: https://platform.openai.com/api-keys

### OpenRouter
- Access 200+ models through a unified API
- Curated models: Llama 3.1, Mistral, Gemini, DeepSeek
- Supports custom model IDs for any OpenRouter model
- Get API key: https://openrouter.ai/keys

### Local LLM (Ollama/LM Studio)
- Run models locally for privacy and offline use
- Default URL: `http://localhost:11434/v1` (Ollama)
- LM Studio: `http://localhost:1234/v1`
- API key optional (only if your server requires auth)
- Enter any model name available on your local server
```

**Step 5: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: add OpenRouter and Local LLM documentation

- Update features list with new providers
- Document all four provider options
- Add new environment variables to config table
- Add LLM Providers section with setup instructions
EOF
)"
```

---

## Task 10: Run Full Test Suite and Verify

**Files:**
- All modified files

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests passing (160+ tests)

**Step 2: Run type checking**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Build the project**

Run: `pnpm build`
Expected: Build successful

**Step 4: Manual verification (optional)**

Start dev server: `pnpm dev`
- Open http://localhost:5173/admin
- Verify OpenRouter and Local LLM appear in provider dropdown
- Verify model field changes based on provider selection
- Verify Local Base URL field appears for Local LLM
- Test with actual API keys if available

**Step 5: Final commit if needed**

```bash
# Only if there were any fixes needed
git add -A
git commit -m "fix: address test/build issues"
```

---

## Summary

| Task | Description | Files Modified |
|------|-------------|----------------|
| 1 | Update shared type definitions | `packages/shared/src/index.ts` |
| 2 | Update facts config store | `packages/server/src/factsConfig.ts` |
| 3 | Implement OpenRouterProvider | `packages/server/src/llm.ts` |
| 4 | Implement LocalLLMProvider | `packages/server/src/llm.ts` |
| 5 | Update environment variables | `.env.example` |
| 6 | Update Admin UI - provider dropdown | `packages/client/src/views/AdminView.vue` |
| 7 | Update Admin UI - model selection | `packages/client/src/views/AdminView.vue` |
| 8 | Update Admin UI - local base URL | `packages/client/src/views/AdminView.vue` |
| 9 | Update README documentation | `README.md` |
| 10 | Run full test suite and verify | All |

**Total estimated commits:** 10
