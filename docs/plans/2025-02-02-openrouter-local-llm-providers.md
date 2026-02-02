# Design: OpenRouter and Local LLM Provider Support

**Date:** 2025-02-02
**Status:** Approved
**Scope:** Add OpenRouter and Local LLM (Ollama/LM Studio) as new AI providers

## Motivation

1. **Access to more models** - Users want models not available through direct Anthropic/OpenAI APIs (Llama, Mistral, Gemini, etc.)
2. **Cost optimization** - OpenRouter offers competitive pricing across providers
3. **User requests** - Community demand for broader model support
4. **Local/private option** - Some users want to run models locally for privacy or offline use

## Architecture Overview

### New Providers

```
packages/server/src/llm.ts
├── LLMProvider (interface)
├── AnthropicProvider (existing)
├── OpenAIProvider (existing)
├── OpenRouterProvider (new)
├── LocalLLMProvider (new)
└── createLLMProvider() - updated factory
```

### Provider Comparison

| Provider | Base URL | API Key | Model Selection |
|----------|----------|---------|-----------------|
| Anthropic | Fixed (Anthropic API) | Required | Curated dropdown |
| OpenAI | Fixed (OpenAI API) | Required | Curated dropdown |
| OpenRouter | Fixed (`openrouter.ai/api/v1`) | Required | Curated + custom |
| Local LLM | Configurable (default: `localhost:11434/v1`) | Optional | Free-form input |

### Type Updates

`packages/shared/src/index.ts`:

```typescript
export const LLM_PROVIDERS = ['anthropic', 'openai', 'openrouter', 'local'] as const;

export const LLM_MODELS = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  openrouter: [
    'meta-llama/llama-3.1-70b-instruct',
    'meta-llama/llama-3.1-8b-instruct',
    'mistralai/mistral-large',
    'mistralai/mistral-small',
    'google/gemini-pro-1.5',
    'google/gemini-flash-1.5',
    'deepseek/deepseek-chat',
    'custom',
  ],
  local: [], // Free-form input, no curated list
};
```

## Configuration Changes

### Updated FactsConfig Interface

`packages/server/src/factsConfig.ts`:

```typescript
interface FactsConfig {
  provider: LLMProvider;         // 'anthropic' | 'openai' | 'openrouter' | 'local'
  model: string;                 // Model name/ID
  apiKey: string;                // Required for cloud providers, optional for local
  factsCount: number;
  rotationInterval: number;
  prompt: string;

  // New field for Local LLM
  localBaseUrl: string;          // Default: 'http://localhost:11434/v1'
}
```

### Environment Variables

`.env.example`:

```bash
# Existing
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# New
OPENROUTER_API_KEY=
LOCAL_LLM_URL=http://localhost:11434/v1   # Optional override
```

### API Key Resolution

```typescript
function getEffectiveApiKey(config: FactsConfig): string {
  switch (config.provider) {
    case 'anthropic':  return process.env.ANTHROPIC_API_KEY || config.apiKey;
    case 'openai':     return process.env.OPENAI_API_KEY || config.apiKey;
    case 'openrouter': return process.env.OPENROUTER_API_KEY || config.apiKey;
    case 'local':      return config.apiKey;  // No env var, optional
  }
}
```

## Provider Implementations

### OpenRouterProvider

```typescript
class OpenRouterProvider implements LLMProvider {
  private config: FactsConfig;

  constructor(config: FactsConfig) {
    this.config = config;
  }

  async generateFacts(artist: string, album: string, title: string): Promise<string[]> {
    const prompt = buildPrompt(this.config, artist, album, title);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/your-repo/roon-now-playing',
        'X-Title': 'Roon Now Playing',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
      }),
    });

    const data = await response.json();
    return parseFactsResponse(data.choices[0].message.content);
  }
}
```

### LocalLLMProvider

```typescript
class LocalLLMProvider implements LLMProvider {
  private config: FactsConfig;

  constructor(config: FactsConfig) {
    this.config = config;
  }

  async generateFacts(artist: string, album: string, title: string): Promise<string[]> {
    const prompt = buildPrompt(this.config, artist, album, title);
    const baseUrl = this.config.localBaseUrl || 'http://localhost:11434/v1';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
      }),
    });

    const data = await response.json();
    return parseFactsResponse(data.choices[0].message.content);
  }
}
```

### Updated Factory

```typescript
export function createLLMProvider(config: FactsConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':      return new OpenAIProvider(config);
    case 'openrouter':  return new OpenRouterProvider(config);
    case 'local':       return new LocalLLMProvider(config);
    case 'anthropic':
    default:            return new AnthropicProvider(config);
  }
}
```

## Admin UI Changes

### Provider Dropdown

Add to existing provider selector:
- Anthropic
- OpenAI
- OpenRouter (new)
- Local LLM (new)

### Dynamic Model Selection

| Provider | Model Field Behavior |
|----------|---------------------|
| Anthropic | Dropdown with curated models |
| OpenAI | Dropdown with curated models |
| OpenRouter | Dropdown with curated models + "Custom..." option. When selected, show text input |
| Local LLM | Text input only (no dropdown) |

### Conditional Fields

When **Local LLM** selected, show:
- **Base URL** - Text input, default: `http://localhost:11434/v1`

### API Key Field

- Always visible for all providers
- For Local LLM: helper text "Optional - only needed if your local server requires authentication"

### Model Field Labels

| Provider | Label | Placeholder |
|----------|-------|-------------|
| OpenRouter (custom) | "Model ID" | "e.g., meta-llama/llama-3.1-70b-instruct" |
| Local LLM | "Model Name" | "e.g., llama3.1, mistral, codellama" |

## Error Handling

| Provider | Error | User Message |
|----------|-------|--------------|
| OpenRouter | Invalid API key | "Invalid OpenRouter API key" |
| OpenRouter | Model not found | "Model '{model}' not available on OpenRouter" |
| OpenRouter | Rate limited | "OpenRouter rate limit exceeded, try again later" |
| Local LLM | Connection refused | "Cannot connect to local LLM at {url}. Is Ollama/LM Studio running?" |
| Local LLM | Model not found | "Model '{model}' not found. Is it installed locally?" |
| Local LLM | Timeout | "Local LLM request timed out" |

### Timeout Configuration

- Cloud providers: 30 seconds (existing)
- Local LLM: 60 seconds (local models can be slower)

## Testing

### Unit Tests (`packages/server/src/llm.spec.ts`)

1. `OpenRouterProvider` creation and generation (mock fetch)
2. `LocalLLMProvider` creation and generation (mock fetch)
3. `LocalLLMProvider` without API key (should still work)
4. `LocalLLMProvider` with custom base URL
5. Factory returns correct provider for `'openrouter'` and `'local'`
6. Error handling for connection failures (Local LLM)

### Manual Testing Checklist

- [ ] OpenRouter: Generate facts with curated model
- [ ] OpenRouter: Generate facts with custom model ID
- [ ] Local LLM: Generate facts with Ollama running
- [ ] Local LLM: Verify error message when Ollama not running
- [ ] Admin UI: Provider switching updates model field correctly
- [ ] Admin UI: Custom model input appears/hides correctly

## Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/index.ts` | Add providers and models to type definitions |
| `packages/server/src/llm.ts` | Add `OpenRouterProvider`, `LocalLLMProvider`, update factory |
| `packages/server/src/factsConfig.ts` | Add `localBaseUrl` field, update defaults |
| `packages/server/src/llm.spec.ts` | Add tests for new providers |
| `packages/client/src/views/AdminView.vue` | Update UI for new providers, conditional fields |
| `.env.example` | Add new environment variables |
| `README.md` | Document new providers, configuration options |

## Documentation Updates

### README.md

Add to configuration section:
- OpenRouter setup instructions and API key
- Local LLM setup with Ollama/LM Studio
- List of supported providers with links

### Curated OpenRouter Models

| Model | Use Case |
|-------|----------|
| `meta-llama/llama-3.1-70b-instruct` | High-quality open model |
| `meta-llama/llama-3.1-8b-instruct` | Fast, cost-effective |
| `mistralai/mistral-large` | Strong reasoning |
| `mistralai/mistral-small` | Fast, affordable |
| `google/gemini-pro-1.5` | Google's flagship |
| `google/gemini-flash-1.5` | Fast Google model |
| `deepseek/deepseek-chat` | Cost-effective alternative |
