// @vitest-environment node

import { EventEmitter } from 'node:events';
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodexAuthService, type CodexAuthServiceOptions } from './codexAuth.js';

interface RequestMessage {
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

class FakeAppServer extends EventEmitter {
  readonly pid = 42_424;
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly requests: RequestMessage[] = [];
  readonly kill = vi.fn((signal?: NodeJS.Signals | number) => {
    if (this.errorOnKill) queueMicrotask(() => this.emit('error', new Error(`kill ${String(signal)} failed`)));
    if (this.exitOnKill) queueMicrotask(() => this.emit('exit', null, signal ?? 'SIGTERM'));
    return true;
  });
  readonly stdin: Writable;
  account: unknown = null;
  loginResponse: unknown = {
    type: 'chatgptDeviceCode',
    loginId: 'login-1',
    verificationUrl: 'https://auth.openai.com/codex/device',
    userCode: 'ABCD-1234',
  };
  cancelStatus: unknown = 'canceled';
  hold = new Set<string>();
  errors = new Map<string, unknown>();
  exitOnKill = true;
  errorOnKill = false;

  constructor() {
    super();
    this.stdin = new Writable({
      write: (chunk, _encoding, callback) => {
        for (const line of chunk.toString().split('\n').filter(Boolean)) {
          const request = JSON.parse(line) as RequestMessage;
          this.requests.push(request);
          this.handle(request);
        }
        callback();
      },
    });
  }

  asChild(): ChildProcessWithoutNullStreams {
    return this as unknown as ChildProcessWithoutNullStreams;
  }

  notify(method: string, params: unknown): void {
    this.stdout.write(`${JSON.stringify({ method, params })}\n`);
  }

  raw(line: string): void {
    this.stdout.write(line);
  }

  crash(): void {
    this.emit('exit', 1, null);
  }

  count(method: string): number {
    return this.requests.filter((request) => request.method === method).length;
  }

  private handle(request: RequestMessage): void {
    if (request.id === undefined || this.hold.has(request.method)) return;
    const error = this.errors.get(request.method);
    if (error !== undefined) {
      this.respond({ id: request.id, error });
      return;
    }
    switch (request.method) {
      case 'initialize':
        this.respond({ id: request.id, result: { userAgent: 'fake' } });
        break;
      case 'account/read':
        this.respond({ id: request.id, result: { account: this.account, requiresOpenaiAuth: true } });
        break;
      case 'account/login/start':
        this.respond({ id: request.id, result: this.loginResponse });
        break;
      case 'account/login/cancel':
        this.respond({ id: request.id, result: { status: this.cancelStatus } });
        break;
      case 'account/logout':
        this.account = null;
        this.respond({ id: request.id, result: {} });
        break;
    }
  }

  private respond(message: unknown): void {
    this.stdout.write(`${JSON.stringify(message)}\n`);
  }
}

describe('CodexAuthService', () => {
  let rootDir: string;
  let homeDir: string;
  const services: CodexAuthService[] = [];

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roon-codex-auth-'));
    homeDir = path.join(rootDir, 'account');
  });

  afterEach(async () => {
    await Promise.all(services.splice(0).map((service) => service.dispose()));
    fs.rmSync(rootDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('spawns lazily with an isolated environment and private storage', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'must-not-leak');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'must-not-leak-either');
    const server = new FakeAppServer();
    let spawnCall: { command: string; args: readonly string[]; options: SpawnOptionsWithoutStdio & { stdio: ['pipe', 'pipe', 'pipe'] } } | undefined;
    const service = createService([server], {
      binaryPath: '/opt/codex',
      spawn: (command, args, options) => {
        spawnCall = { command, args, options };
        return server.asChild();
      },
    });

    expect(fs.existsSync(homeDir)).toBe(false);
    expect(await service.getStatus()).toMatchObject({ state: 'signed-out', generationEnabled: false });
    expect(spawnCall).toMatchObject({
      command: '/opt/codex',
      args: ['app-server', '--strict-config'],
      options: { cwd: path.join(homeDir, 'workspace'), shell: false, stdio: ['pipe', 'pipe', 'pipe'] },
    });
    expect(spawnCall!.options.env).toMatchObject({
      HOME: path.join(homeDir, 'home'),
      CODEX_HOME: path.join(homeDir, 'codex-home'),
      NO_COLOR: '1',
    });
    expect(spawnCall!.options.env).not.toHaveProperty('OPENAI_API_KEY');
    expect(spawnCall!.options.env).not.toHaveProperty('AWS_SECRET_ACCESS_KEY');
    expect(server.requests.slice(0, 3).map(({ method }) => method)).toEqual([
      'initialize', 'initialized', 'account/read',
    ]);
    expect(server.requests.some(({ method }) => method === 'thread/start' || method === 'turn/start')).toBe(false);

    for (const directory of [homeDir, 'home', 'codex-home', 'workspace'].map((name) =>
      name === homeDir ? name : path.join(homeDir, name))) {
      expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
    }
    const configPath = path.join(homeDir, 'codex-home', 'config.toml');
    expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
    expect(fs.readFileSync(configPath, 'utf8')).toContain('cli_auth_credentials_store = "file"');
    expect(fs.readFileSync(configPath, 'utf8')).toContain('project_doc_max_bytes = 0');
    expect(fs.readFileSync(configPath, 'utf8')).toContain('include_instructions = false');
  });

  it('preserves existing credentials and tightens their permissions', async () => {
    const codexHome = path.join(homeDir, 'codex-home');
    fs.mkdirSync(codexHome, { recursive: true });
    const authPath = path.join(codexHome, 'auth.json');
    fs.writeFileSync(authPath, '{"tokens":"opaque"}', { mode: 0o644 });
    const service = createService([new FakeAppServer()]);

    await service.getStatus();

    expect(fs.readFileSync(authPath, 'utf8')).toBe('{"tokens":"opaque"}');
    expect(fs.statSync(authPath).mode & 0o777).toBe(0o600);
  });

  it('refuses a credential directory symlink instead of following it', async () => {
    const outside = path.join(rootDir, 'outside-codex-home');
    fs.mkdirSync(outside, { mode: 0o755 });
    const outsideAuth = path.join(outside, 'auth.json');
    fs.writeFileSync(outsideAuth, '{"tokens":"do-not-import"}', { mode: 0o644 });
    fs.mkdirSync(homeDir, { recursive: true });
    fs.symlinkSync(outside, path.join(homeDir, 'codex-home'));
    const server = new FakeAppServer();
    const service = createService([server]);

    expect(await service.getStatus()).toMatchObject({
      state: 'unavailable', error: 'Codex account service is unavailable',
    });
    expect(server.requests).toEqual([]);
    expect(fs.readFileSync(outsideAuth, 'utf8')).toBe('{"tokens":"do-not-import"}');
    expect(fs.statSync(outsideAuth).mode & 0o777).toBe(0o644);
  });

  it('starts one device-code attempt and returns it during duplicate requests and polling', async () => {
    const server = new FakeAppServer();
    const service = createService([server], { now: () => 1_000, loginTimeoutMs: 600_000 });

    const [first, duplicate] = await Promise.all([service.startLogin(), service.startLogin()]);
    const polled = await service.getStatus();

    expect(first).toEqual(duplicate);
    expect(polled).toEqual(first);
    expect(first).toMatchObject({
      state: 'signing-in',
      login: {
        loginId: 'login-1',
        verificationUrl: 'https://auth.openai.com/codex/device',
        userCode: 'ABCD-1234',
        expiresAt: new Date(601_000).toISOString(),
      },
      generationEnabled: false,
    });
    expect(server.count('account/login/start')).toBe(1);
    expect(server.requests.find(({ method }) => method === 'account/login/start')?.params).toEqual({
      type: 'chatgptDeviceCode',
    });
  });

  it('reads full account data after a matching successful completion', async () => {
    const server = new FakeAppServer();
    const service = createService([server]);
    await service.startLogin();
    server.account = { type: 'chatgpt', email: 'listener@example.com', planType: 'plus' };

    server.notify('account/login/completed', { loginId: 'login-1', success: true, error: null });

    await vi.waitFor(() => expect(server.count('account/read')).toBeGreaterThanOrEqual(2));
    expect(await service.getStatus()).toEqual({
      state: 'signed-in',
      account: { email: 'listener@example.com', planType: 'plus' },
      login: null,
      error: null,
      generationEnabled: false,
    });
  });

  it('sanitizes login failures and ignores stale completion ids', async () => {
    const server = new FakeAppServer();
    const service = createService([server]);
    await service.startLogin();

    server.notify('account/login/completed', { loginId: 'older-login', success: false, error: 'raw detail' });
    expect((await service.cancelLogin('stale')).state).toBe('signing-in');

    server.notify('account/login/completed', { success: false, error: 'raw secret' });
    expect(await service.cancelLogin('stale')).toEqual({
      state: 'signed-out', account: null, login: null,
      error: 'ChatGPT sign-in failed', generationEnabled: false,
    });
  });

  it.each(['canceled', 'notFound'])('accepts %s cancellation and does not send stale cancellation', async (cancelStatus) => {
    const server = new FakeAppServer();
    server.cancelStatus = cancelStatus;
    const service = createService([server]);
    await service.startLogin();

    expect((await service.cancelLogin('other-login')).state).toBe('signing-in');
    expect(server.count('account/login/cancel')).toBe(0);
    expect(await service.cancelLogin('login-1')).toMatchObject({ state: 'signed-out', error: null });
    expect(server.count('account/login/cancel')).toBe(1);
    expect(server.count('account/logout')).toBe(1);
    expect(server.kill).toHaveBeenCalledOnce();
  });

  it('cannot resurrect a canceled attempt from late notifications or persisted state', async () => {
    const canceled = new FakeAppServer();
    const restarted = new FakeAppServer();
    const service = createService([canceled, restarted]);
    await service.startLogin();
    expect((await service.cancelLogin('login-1')).state).toBe('signed-out');

    canceled.account = { type: 'chatgpt', email: 'late@example.com', planType: 'plus' };
    canceled.notify('account/login/completed', { loginId: null, success: true, error: null });
    canceled.notify('account/updated', { authMode: 'chatgpt', planType: 'plus' });

    expect((await service.getStatus()).state).toBe('signed-out');
    expect(restarted.count('account/read')).toBe(1);
  });

  it('logs out and terminates an active login before another process can inspect credentials', async () => {
    const active = new FakeAppServer();
    const restarted = new FakeAppServer();
    const service = createService([active, restarted]);
    await service.startLogin();

    expect(await service.logout()).toMatchObject({ state: 'signed-out', error: null });
    expect(active.requests.filter(({ method }) =>
      method === 'account/login/cancel' || method === 'account/logout').map(({ method }) => method)).toEqual([
      'account/login/cancel', 'account/logout',
    ]);
    expect(active.kill).toHaveBeenCalledOnce();
    active.account = { type: 'chatgpt', email: 'late@example.com', planType: 'plus' };
    active.notify('account/login/completed', { loginId: null, success: true, error: null });

    expect((await service.getStatus()).state).toBe('signed-out');
    expect(restarted.count('account/read')).toBe(1);
  });

  it('expires locally, cancels upstream, and ignores late completion', async () => {
    let now = 5_000;
    const server = new FakeAppServer();
    const service = createService([server], { now: () => now, loginTimeoutMs: 100 });
    await service.startLogin();
    now += 101;

    expect(await service.getStatus()).toMatchObject({ state: 'signed-out', error: 'ChatGPT sign-in expired' });
    expect(server.count('account/login/cancel')).toBe(1);
    expect(server.count('account/logout')).toBe(1);
    expect(server.kill).toHaveBeenCalledOnce();
    server.notify('account/login/completed', { loginId: 'login-1', success: true, error: null });
    expect(await service.cancelLogin('stale')).toMatchObject({ state: 'signed-out', error: 'ChatGPT sign-in expired' });
  });

  it('logs out, stops the process, and ignores its late account notification', async () => {
    const first = new FakeAppServer();
    first.account = { type: 'chatgpt', email: 'old@example.com', planType: 'pro' };
    const second = new FakeAppServer();
    const service = createService([first, second]);
    expect((await service.getStatus()).state).toBe('signed-in');

    expect(await service.logout()).toMatchObject({ state: 'signed-out', error: null });
    expect(first.kill).toHaveBeenCalledOnce();
    first.account = { type: 'chatgpt', email: 'late@example.com', planType: 'pro' };
    first.notify('account/updated', { authMode: 'chatgpt', planType: 'pro' });
    expect((await service.cancelLogin('stale')).state).toBe('signed-out');
    expect((await service.getStatus()).state).toBe('signed-out');
    expect(second.count('account/read')).toBe(1);
  });

  it('restarts supervision on the next status read after a crash', async () => {
    const first = new FakeAppServer();
    const second = new FakeAppServer();
    second.account = { type: 'chatgpt', email: null, planType: 'team' };
    const service = createService([first, second]);
    expect((await service.getStatus()).state).toBe('signed-out');
    first.crash();

    expect(await service.getStatus()).toMatchObject({
      state: 'signed-in', account: { email: null, planType: 'team' }, error: null,
    });
  });

  it.each([
    'http://auth.openai.com/codex/device',
    'https://auth.openai.com/codex/device?code=secret',
    'https://auth.openai.com/codex/device#fragment',
    'https://auth.openai.com.evil.test/codex/device',
    'https://user:pass@auth.openai.com/codex/device',
    'https://auth.openai.com:443/codex/device',
  ])('rejects an unexpected verification URL: %s', async (verificationUrl) => {
    const server = new FakeAppServer();
    server.loginResponse = { ...server.loginResponse as object, verificationUrl };
    const service = createService([server]);

    expect(await service.startLogin()).toMatchObject({ state: 'unavailable', error: 'Unable to start ChatGPT sign-in' });
    expect(server.kill).toHaveBeenCalledOnce();
  });

  it('rejects API-key account mode without exposing account details', async () => {
    const server = new FakeAppServer();
    server.account = { type: 'apiKey', apiKey: 'sk-secret' };
    const service = createService([server]);

    expect(await service.getStatus()).toEqual({
      state: 'unavailable', account: null, login: null,
      error: 'Unsupported Codex account mode', generationEnabled: false,
    });
    expect(server.kill).toHaveBeenCalledOnce();
  });

  it('kills malformed and oversized protocol streams with a stable error', async () => {
    const malformed = new FakeAppServer();
    const oversized = new FakeAppServer();
    const service = createService([malformed, oversized], { maxMessageBytes: 128 });
    await service.getStatus();
    malformed.raw('{not json}\n');
    expect(await service.cancelLogin('stale')).toMatchObject({ state: 'unavailable', error: 'Codex account service is unavailable' });
    expect(malformed.kill).toHaveBeenCalledOnce();

    await service.getStatus();
    oversized.raw('x'.repeat(129));
    expect(await service.cancelLogin('stale')).toMatchObject({ state: 'unavailable', error: 'Codex account service is unavailable' });
    expect(oversized.kill).toHaveBeenCalledOnce();
  });

  it('sanitizes RPC errors and request timeouts and can retry afterward', async () => {
    const rejected = new FakeAppServer();
    rejected.errors.set('account/read', { code: -32_000, message: 'raw subprocess detail' });
    const hanging = new FakeAppServer();
    hanging.hold.add('account/read');
    const recovered = new FakeAppServer();
    const service = createService([rejected, hanging, recovered], { requestTimeoutMs: 15 });

    expect(await service.getStatus()).toMatchObject({ state: 'unavailable', error: 'Codex account service is unavailable' });
    expect(rejected.kill).toHaveBeenCalledOnce();
    expect(await service.getStatus()).toMatchObject({ state: 'unavailable', error: 'Codex account service is unavailable' });
    expect(hanging.kill).toHaveBeenCalledOnce();
    expect((await service.getStatus()).state).toBe('signed-out');
  });

  it('makes disposal terminal and rejects pending work without respawning', async () => {
    const server = new FakeAppServer();
    server.hold.add('account/read');
    const unused = new FakeAppServer();
    const service = createService([server, unused], { requestTimeoutMs: 5_000 });
    const pending = service.getStatus();
    await vi.waitFor(() => expect(server.count('account/read')).toBe(1));

    await service.dispose();
    expect(await pending).toMatchObject({ state: 'unavailable' });
    expect(await service.getStatus()).toMatchObject({ state: 'unavailable' });
    expect(unused.requests).toEqual([]);
  });

  it('expires and terminates a login without another UI request', async () => {
    const server = new FakeAppServer();
    const service = createService([server], { loginTimeoutMs: 15, terminationTimeoutMs: 10 });
    await service.startLogin();

    await vi.waitFor(() => expect(server.count('account/logout')).toBe(1));
    expect(server.count('account/login/cancel')).toBe(1);
    expect(server.kill).toHaveBeenCalledOnce();
    expect(await service.cancelLogin('stale')).toMatchObject({
      state: 'signed-out', error: 'ChatGPT sign-in expired',
    });
  });

  it('accepts a null completion id for the sole live attempt', async () => {
    const server = new FakeAppServer();
    const service = createService([server]);
    await service.startLogin();
    server.account = { type: 'chatgpt', email: 'null-id@example.com', planType: 'plus' };

    server.notify('account/login/completed', { loginId: null, success: true, error: null });

    await vi.waitFor(() => expect(server.count('account/read')).toBeGreaterThanOrEqual(2));
    expect(await service.getStatus()).toMatchObject({
      state: 'signed-in', account: { email: 'null-id@example.com', planType: 'plus' },
    });
  });

  it('uses SIGKILL and blocks respawn when a child does not terminate', async () => {
    const stuck = new FakeAppServer();
    stuck.exitOnKill = false;
    stuck.errorOnKill = true;
    stuck.hold.add('account/read');
    const unused = new FakeAppServer();
    const service = createService([stuck, unused], {
      requestTimeoutMs: 5,
      terminationTimeoutMs: 5,
    });

    expect(await service.getStatus()).toMatchObject({ state: 'unavailable' });
    expect(stuck.kill).toHaveBeenNthCalledWith(1, 'SIGTERM');
    expect(stuck.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
    expect(await service.getStatus()).toMatchObject({ state: 'unavailable' });
    expect(unused.requests).toEqual([]);
  });

  it.each(['stdin', 'stdout', 'stderr'] as const)(
    'handles %s errors without exposing details or leaving the child active', async (stream) => {
    const failed = new FakeAppServer();
    const recovered = new FakeAppServer();
    const service = createService([failed, recovered]);
    expect((await service.getStatus()).state).toBe('signed-out');

    failed[stream].emit('error', new Error('EPIPE with raw process detail'));

    expect(await service.cancelLogin('stale')).toMatchObject({
      state: 'unavailable', error: 'Codex account service is unavailable',
    });
    expect(failed.kill).toHaveBeenCalledOnce();
    expect((await service.getStatus()).state).toBe('signed-out');
  });

  function createService(servers: FakeAppServer[], overrides: Partial<CodexAuthServiceOptions> = {}): CodexAuthService {
    const spawn = overrides.spawn ?? (() => {
      const server = servers.shift();
      if (!server) throw new Error('Unexpected process spawn');
      return server.asChild();
    });
    const service = new CodexAuthService({ homeDir, ...overrides, spawn });
    services.push(service);
    return service;
  }
});
