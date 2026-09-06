import fs from 'node:fs/promises';
import { parseArgs } from 'node:util';
import OpenAI from 'openai';
import {
  DEFAULT_FACTS_PROMPT,
  getOpenAIReasoningEfforts,
  getRecommendedFactsOutputTokens,
  type FactsConfig,
  type OpenAIReasoningEffort,
} from '@roon-screen-cover/shared';
import { buildOpenAIFactsRequest, parseOpenAIFactsCompletion } from '../src/llm.js';
import { OutputLimitError } from '../src/llmErrors.js';

const { values } = parseArgs({ options: {
  run: { type: 'boolean', default: false },
  model: { type: 'string', default: 'gpt-5.6-luna' },
  efforts: { type: 'string', default: 'none,low' },
  limit: { type: 'string', default: '3' },
  'max-output-tokens': { type: 'string' },
  output: { type: 'string' },
} });

const fixtures = [
  { artist: 'The Beatles', album: 'Abbey Road', title: 'Come Together', language: 'English', prompt: DEFAULT_FACTS_PROMPT },
  { artist: 'David Bowie', album: '"Heroes"', title: '"Heroes"', language: 'English', prompt: DEFAULT_FACTS_PROMPT },
  { artist: 'Milton Nascimento', album: 'Clube da Esquina', title: 'Tudo o Que Você Podia Ser', language: 'Portuguese',
    prompt: `Responda em português brasileiro.\n${DEFAULT_FACTS_PROMPT}` },
];
const model = values.model;
const efforts = [...new Set(values.efforts.split(',').map((effort) => effort.trim()))];
const supported = getOpenAIReasoningEfforts(model);
const limit = Number(values.limit);
const maxOutputTokens = values['max-output-tokens'] === undefined
  ? getRecommendedFactsOutputTokens('openai', model) : Number(values['max-output-tokens']);
if (!Number.isInteger(limit) || limit < 1 || limit > fixtures.length
  || efforts.length === 0 || efforts.some((effort) => !supported.includes(effort as OpenAIReasoningEffort))
  || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 8192
  || limit * efforts.length > 12) {
  throw new Error('Use 1–3 fixtures, supported reasoning efforts, at most 12 calls, and a 1–8192 token cap.');
}

if (!values.run) {
  console.log(JSON.stringify({ mode: 'dry-run', model, efforts, calls: limit * efforts.length, maxOutputTokens,
    next: 'Add --run with OPENAI_API_KEY set to make billed requests; optionally save samples with --output <path>.' }, null, 2));
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for --run.');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 0 });
const samples: Array<Record<string, unknown>> = [];
let failed = false;
let stop = false;
for (const fixture of fixtures.slice(0, limit)) {
  for (const effort of efforts) {
    const config: FactsConfig = {
      provider: 'openai', apiKey: '', model, factsCount: 5, rotationInterval: 25,
      prompt: fixture.prompt, maxOutputTokens, openaiReasoningEffort: effort as OpenAIReasoningEffort,
    };
    const startedAt = Date.now();
    const sample: Record<string, unknown> = { artist: fixture.artist, album: fixture.album, title: fixture.title,
      language: fixture.language, model, effort, maxOutputTokens };
    try {
      const completion = await client.chat.completions.create(buildOpenAIFactsRequest(config, fixture.artist, fixture.album, fixture.title));
      sample.durationMs = Date.now() - startedAt;
      sample.usage = completion.usage ?? null;
      sample.finishReason = completion.choices[0]?.finish_reason ?? null;
      const facts = parseOpenAIFactsCompletion(completion, config);
      sample.facts = facts;
      sample.factCount = facts.length;
      sample.valid = facts.length > 0 && facts.length <= config.factsCount;
      if (!sample.valid) failed = true;
    } catch (error) {
      failed = true;
      sample.durationMs = Date.now() - startedAt;
      sample.valid = false;
      sample.error = error instanceof OutputLimitError ? 'output-limit'
        : error instanceof OpenAI.APIError ? `api-${error.status ?? 'connection'}` : 'generation-failed';
      // Authentication, quota/rate-limit, or model-access failures should stop the benchmark.
      stop = error instanceof OpenAI.APIError && [401, 403, 404, 429].includes(error.status ?? 0);
      if (error instanceof OpenAI.APIError && ['insufficient_quota', 'rate_limit_exceeded', 'invalid_api_key', 'model_not_found'].includes(error.code ?? '')) sample.reason = error.code;
    }
    samples.push(sample);
    const summary = { ...sample };
    delete summary.facts;
    console.log(JSON.stringify(summary));
    if (stop) break;
  }
  if (stop) break;
}
const report = { generatedAt: new Date().toISOString(), model, maxOutputTokens, samples,
  note: 'Validity checks structure and count, not factual truth. Review the saved facts and language manually.' };
if (values.output) await fs.writeFile(values.output, JSON.stringify(report, null, 2) + '\n');
process.exitCode = failed ? 1 : 0;
