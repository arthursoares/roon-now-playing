import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  getOpenAIReasoningEffort,
  getOpenAIReasoningEfforts,
  getRecommendedFactsOutputTokens,
  isGpt56Model,
  isOriginalGpt5Model,
  type FactsConfig,
} from '@roon-screen-cover/shared';
import { logger } from './logger.js';
import { parseFactsResponse as parseFacts } from './parseFacts.js';
import { OutputLimitError } from './llmErrors.js';

export interface LLMProvider {
  generateFacts(artist: string, album: string, title: string): Promise<string[]>;
}

const PROVIDER_TIMEOUT_MS = 120_000;
const OPENAI_FACTS_FORMAT_INSTRUCTION = [
  'Return exactly one JSON object with a "facts" property containing an array of fact strings.',
  'Follow the supplied JSON schema even if the user prompt requests a top-level JSON array or another format.',
].join(' ');

function buildPrompt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(artist|album|title|factsCount)\}/g, (_match, key: string) => (
    Object.hasOwn(vars, key) ? String(vars[key]) : _match
  ));
}

function parseFactsResponse(text: string): string[] {
  const facts = parseFacts(text);
  if (facts.length === 0) {
    logger.warn(`[ParseFacts] No usable facts in ${text.length} response characters.`);
  }
  return facts;
}

function getMaxOutputTokens(config: FactsConfig): number {
  return config.maxOutputTokens ?? getRecommendedFactsOutputTokens(config.provider, config.model);
}

type OpenAIFactsRequest = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
type OpenAIFactsCompletion = Pick<OpenAI.Chat.Completions.ChatCompletion, 'choices'>;

function usesOpenAIStructuredFacts(model: string): boolean {
  return isGpt56Model(model)
    || isOriginalGpt5Model(model)
    || model === 'gpt-5.5'
    || model === 'gpt-6-astra';
}

export function buildOpenAIFactsRequest(
  config: FactsConfig,
  artist: string,
  album: string,
  title: string,
): OpenAIFactsRequest {
  const prompt = buildPrompt(config.prompt, {
    artist,
    album,
    title,
    factsCount: config.factsCount,
  });
  const reasoningEffort = getOpenAIReasoningEffort(config.model, config.openaiReasoningEffort);
  const request: OpenAIFactsRequest = {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    // max_completion_tokens includes visible output and hidden reasoning tokens.
    max_completion_tokens: getMaxOutputTokens(config),
  };

  if (reasoningEffort !== undefined) request.reasoning_effort = reasoningEffort;
  if (usesOpenAIStructuredFacts(config.model)) {
    request.messages.unshift({ role: 'developer', content: OPENAI_FACTS_FORMAT_INSTRUCTION });
    request.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'music_facts',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            facts: { type: 'array', items: { type: 'string' } },
          },
          required: ['facts'],
          additionalProperties: false,
        },
      },
    };
  }

  return request;
}

export function parseOpenAIFactsCompletion(
  response: OpenAIFactsCompletion,
  config: FactsConfig,
): string[] {
  const choice = response.choices[0];
  const reasoningEffort = getOpenAIReasoningEffort(config.model, config.openaiReasoningEffort);
  if (choice?.finish_reason === 'length') {
    const supportedEfforts = getOpenAIReasoningEfforts(config.model);
    const reasoningIndex = reasoningEffort === undefined ? -1 : supportedEfforts.indexOf(reasoningEffort);
    throw new OutputLimitError(getMaxOutputTokens(config), {
      reasoningEffort,
      canLowerReasoning: reasoningIndex > 0,
    });
  }

  if (!choice
    || choice.finish_reason !== 'stop'
    || choice.message.refusal
    || typeof choice.message.content !== 'string') return [];

  if (!usesOpenAIStructuredFacts(config.model)) {
    return parseFactsResponse(choice.message.content);
  }

  try {
    const parsed: unknown = JSON.parse(choice.message.content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return [];
    const facts = (parsed as Record<string, unknown>).facts;
    if (!Array.isArray(facts)
      || facts.length === 0
      || !facts.every((fact) => typeof fact === 'string' && fact.trim().length > 0)) return [];
    return facts as string[];
  } catch {
    return [];
  }
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
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: PROVIDER_TIMEOUT_MS,
      maxRetries: 0,
    });
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
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: PROVIDER_TIMEOUT_MS,
      maxRetries: 0,
    });
  }

  async generateFacts(artist: string, album: string, title: string): Promise<string[]> {
    try {
      const request = buildOpenAIFactsRequest(this.config, artist, album, title);
      const response = await this.client.chat.completions.create(request);
      return parseOpenAIFactsCompletion(response, this.config);
    } catch (error) {
      logProviderError('OpenAI API', error);
      throw error;
    }
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
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
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
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
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
