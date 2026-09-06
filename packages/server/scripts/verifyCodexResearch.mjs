// Actual Codex runtime, with account/model metadata and all provider traffic mocked.
// This check never reads existing credentials or sends a model request to OpenAI.
import { EventEmitter } from 'node:events';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { PassThrough, Writable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { CodexAuthService } from '../dist/codexAuth.js';

const source = 'https://example.com/source';
const finalText = JSON.stringify({
  facts: [{ text: 'The fixture album was recorded in a studio.', scope: 'album', trackTitle: null, sourceUrls: [source] }],
  sources: [{ url: source, title: 'Offline fixture source' }],
});
let responses = 0;
let searches = 0;
let requestContract;
let fixtureFailure;
const rpcMethods = [];

const provider = createServer(async (req, res) => {
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      assert.ok(bytes <= 2 * 1024 * 1024, 'Fixture request exceeded its byte bound');
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (req.url === '/v1/alpha/search') {
      searches += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ output: `Offline music history. Source: ${source}`, results: [{ url: source, title: 'Offline fixture source' }] }));
      return;
    }
    assert.equal(req.url, '/v1/responses');
    responses += 1;
    assert.ok(responses <= 2, 'Unexpected additional model exchange');
    requestContract = { effort: body.reasoning?.effort, format: body.text?.format?.type };
    assert.equal('max_output_tokens' in body, false);
    const item = responses === 1 ? {
      type: 'custom_tool_call', id: 'ctc_fixture', call_id: 'call_fixture', namespace: 'functions', name: 'exec',
      input: [
        "const names = ALL_TOOLS.map(tool => tool.name).sort();",
        "if (JSON.stringify(names) !== JSON.stringify(['skills__list','skills__read','web__run'])) throw new Error('Unexpected tool inventory');",
        "text(await tools.web__run({search_query:[{q:'offline fixture album history'}],response_length:'short'}));",
        `text(await tools.web__run({open:[{ref_id:${JSON.stringify(source)}}],response_length:'short'}));`,
      ].join('\n'),
    } : {
      type: 'message', id: 'msg_fixture', role: 'assistant', phase: 'final_answer', status: 'completed',
      content: [{ type: 'output_text', text: finalText, annotations: [] }],
    };
    const id = `resp_${responses}`;
    const events = [
      { type: 'response.created', response: { id, status: 'in_progress', output: [] } },
      { type: 'response.output_item.added', output_index: 0, item },
      { type: 'response.output_item.done', output_index: 0, item },
      { type: 'response.completed', response: {
        id, status: 'completed', output: [item],
        usage: { input_tokens: responses === 1 ? 11 : 13, output_tokens: responses === 1 ? 7 : 5, total_tokens: 18 },
      } },
    ];
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const event of events) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    res.end();
  } catch (error) {
    fixtureFailure = error;
    res.writeHead(500);
    res.end('Offline fixture failed');
  }
});

await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
const port = provider.address().port;
const homeDir = await mkdtemp(path.join(tmpdir(), 'roon-codex-research-check-'));
await chmod(homeDir, 0o700);

const service = new CodexAuthService({
  homeDir,
  generationEnabled: true,
  binaryPath: process.env.CODEX_BINARY || 'codex',
  researchTimeoutMs: 60_000,
  requestTimeoutMs: 15_000,
  spawn(command, args, options) {
    const providerConfig = `model_providers.offline_probe={name="Offline",base_url="http://127.0.0.1:${port}/v1",wire_api="responses",requires_openai_auth=false,supports_standalone_web_search=true,request_max_retries=0,stream_max_retries=0}`;
    const actual = spawn(command, [...args, '-c', 'model_provider="offline_probe"', '-c', providerConfig], options);
    const proxy = new EventEmitter();
    proxy.stdout = new PassThrough();
    proxy.stderr = new PassThrough();
    proxy.pid = actual.pid;
    proxy.kill = signal => actual.kill(signal);
    const reply = (id, result) => Promise.resolve().then(() => proxy.stdout.write(`${JSON.stringify({ id, result })}\n`));
    proxy.stdin = new Writable({
      write(chunk, _encoding, callback) {
        for (const line of chunk.toString().trim().split('\n')) {
          const message = JSON.parse(line);
          rpcMethods.push(message.method);
          if (message.method === 'account/read') {
            reply(message.id, { account: { type: 'chatgpt', email: 'offline-fixture@example.com', planType: 'plus' } });
          } else if (message.method === 'model/list') {
            reply(message.id, { data: [{ model: 'gpt-5.6-luna', supportedReasoningEfforts: [{ reasoningEffort: 'low' }] }], nextCursor: null });
          } else {
            actual.stdin.write(`${line}\n`);
          }
        }
        callback();
      },
      final(callback) { actual.stdin.end(); callback(); },
    });
    actual.stdout.on('data', chunk => proxy.stdout.write(chunk));
    actual.stderr.on('data', chunk => proxy.stderr.write(chunk));
    for (const stream of ['stdin', 'stdout', 'stderr']) actual[stream].on('error', error => proxy[stream].emit('error', error));
    for (const event of ['error', 'exit', 'close']) actual.on(event, (...values) => proxy.emit(event, ...values));
    return proxy;
  },
});

try {
  const accountKey = await service.getResearchAccountKey();
  const result = await service.research({
    artist: 'Fixture Artist', album: 'Fixture Album', title: 'Fixture Track', accountKey,
    model: 'gpt-5.6-luna', prompt: 'Recording history', factsCount: 4, focus: 'album',
  });
  assert.ifError(fixtureFailure);
  assert.equal(responses, 2);
  assert.equal(searches, 2);
  assert.equal(result.facts.length, 1);
  assert.equal(result.sources[0].url, source);
  assert.equal(result.webSearches, 1);
  assert.equal(result.openPages, 1);
  assert.equal(result.inputTokens, 24);
  assert.equal(result.outputTokens, 12);
  assert.deepEqual(requestContract, { effort: 'low', format: 'json_schema' });
  assert.equal(rpcMethods.some(method => method.startsWith('account/login')), false);
  process.stdout.write('Codex research runtime passed: restricted tools, source events, structured facts, cumulative usage, and cleanup. Auth and provider responses were mocked; no external model request occurred.\n');
} finally {
  await service.dispose();
  await new Promise(resolve => provider.close(resolve));
  await rm(homeDir, { recursive: true, force: true });
}
