import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { DEFAULT_MAX_OUTPUT_TOKENS, type FactsConfig } from '@roon-screen-cover/shared';
import { logger } from './logger.js';
import { parseFactsResponse as parseFacts } from './parseFacts.js';
import { OutputLimitError } from './llmErrors.js';

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
  const facts = parseFacts(text);
  if (facts.length === 0) {
    logger.warn(`[ParseFacts] No usable facts in ${text.length} response characters.`);
  }
  return facts;
}

function getMaxOutputTokens(config: FactsConfig): number {
  return config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
}

class ProviderHttpError extends Error {
  constructor(readonly status: number) {
    super('Provider request failed');
    this.name = 'ProviderHttpError';
  }
}

function logProviderError(provider: string, error: unknown): void {
  if (error instanceof OutputLimitError) {
    logger.warn(`${provider} response reached the configured output limit`);
  } else {
    const status = typeof error === 'object'
      && error !== null
      && 'status' in error
      && typeof error.status === 'number'
      && Number.isInteger(error.status)
      ? error.status
      : undefined;
    logger.error(status === undefined
      ? `${provider} request failed`
      : `${provider} request failed with HTTP status ${status}`);
  }
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
        max_tokens: getMaxOutputTokens(this.config),
        messages: [{ role: 'user', content: prompt }],
      });

      if (response.stop_reason === 'max_tokens') {
        throw new OutputLimitError(getMaxOutputTokens(this.config));
      }

      const textContent = response.content.find((c) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        return parseFactsResponse(textContent.text);
      }
    } catch (error) {
      logProviderError('Anthropic API', error);
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
        // max_completion_tokens replaces the deprecated max_tokens and is required
        // by reasoning models (gpt-5 family, o-series); accepted by gpt-4.x too.
        max_completion_tokens: getMaxOutputTokens(this.config),
      });

      const choice = response.choices[0];
      if (choice?.finish_reason === 'length') {
        throw new OutputLimitError(getMaxOutputTokens(this.config));
      }

      const content = choice?.message?.content;
      if (content) {
        return parseFactsResponse(content);
      }
    } catch (error) {
      logProviderError('OpenAI API', error);
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
          max_tokens: getMaxOutputTokens(this.config),
        }),
      });

      if (!response.ok) {
        throw new ProviderHttpError(response.status);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      if (choice?.finish_reason === 'length') {
        throw new OutputLimitError(getMaxOutputTokens(this.config));
      }

      const content = choice?.message?.content;
      if (content) {
        return parseFactsResponse(content);
      }
    } catch (error) {
      logProviderError('OpenRouter API', error);
      throw error;
    }

    return [];
  }
}

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
    const url = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const requestBody = {
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: getMaxOutputTokens(this.config),
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      logger.info(`[LocalLLM] Response status: ${response.status}`);

      if (!response.ok) {
        throw new ProviderHttpError(response.status);
      }

      const data = await response.json();

      const choice = data.choices?.[0];
      if (choice?.finish_reason === 'length') {
        throw new OutputLimitError(getMaxOutputTokens(this.config));
      }

      // Try content first, then reasoning (for "thinking" models like lfm2.5-thinking)
      let content = choice?.message?.content;

      // Some thinking models put output in "reasoning" field instead of "content"
      if (!content && data.choices?.[0]?.message?.reasoning) {
        content = data.choices[0].message.reasoning;
        logger.info(`[LocalLLM] Using 'reasoning' field from thinking model`);
      }

      if (content) {
        logger.info(`[LocalLLM] Got response content (${content.length} chars)`);
        return parseFactsResponse(content);
      } else {
        logger.warn('[LocalLLM] No content in response');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        logger.error('Local LLM connection failed');
        throw new Error('Cannot connect to the local LLM. Is Ollama/LM Studio running?', { cause: error });
      }
      logProviderError('Local LLM API', error);
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
    case 'local':
      return new LocalLLMProvider(config);
    case 'anthropic':
    default:
      return new AnthropicProvider(config);
  }
}
