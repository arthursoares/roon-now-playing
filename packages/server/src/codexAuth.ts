import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { CodexAccountStatus } from '@roon-screen-cover/shared';
import type { CodexResearchClient, CodexResearchRequest, CodexResearchResult } from './codexResearchTypes.js';
import { CodexResearchError } from './codexResearchTypes.js';
import {
  RESEARCH_BASE_INSTRUCTIONS,
  RESEARCH_OUTPUT_SCHEMA,
  collectResearchItem,
  collectResearchUsage,
  createResearchPrompt,
  parseResearchResult,
  type ResearchEvidence,
} from './codexResearchProtocol.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_LOGIN_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_TERMINATION_TIMEOUT_MS = 1_000;
const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024;
const DEFAULT_GENERATION_MAX_MESSAGE_BYTES = 1024 * 1024;
const MAX_PENDING_REQUESTS = 16;
const DEFAULT_RESEARCH_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_RESEARCH_RESPONSE_BYTES = 256 * 1024;
const MODEL_PAGE_SIZE = 100;
const MAX_MODEL_PAGES = 20;
const RESEARCH_DISABLED_FEATURES = [
  'apps',
  'plugins',
  'hooks',
  'shell_snapshot',
  'shell_tool',
  'unified_exec',
  'multi_agent',
  'multi_agent_v2',
  'code_mode',
  'browser_use',
  'browser_use_external',
  'computer_use',
  'image_generation',
  'in_app_browser',
  'view_image',
  'memories',
  'skill_search',
  'skill_mcp_dependency_install',
  'workspace_dependencies',
  'goals',
  'sleep_tool',
  'tool_suggest',
  'recommended_plugins',
  'enable_request_compression',
] as const;

const UNAVAILABLE_ERROR = 'Codex account service is unavailable';
const UNSUPPORTED_ACCOUNT_ERROR = 'Unsupported Codex account mode';
const LOGIN_ERROR = 'Unable to start ChatGPT sign-in';
const LOGIN_FAILED_ERROR = 'ChatGPT sign-in failed';
const LOGIN_EXPIRED_ERROR = 'ChatGPT sign-in expired';
const CANCEL_ERROR = 'Unable to cancel ChatGPT sign-in';
const LOGOUT_ERROR = 'Unable to sign out from ChatGPT';

type RpcMethod = 'initialize' | 'account/read' | 'account/login/start' | 'account/login/cancel' | 'account/logout'
  | 'model/list' | 'thread/start' | 'turn/start' | 'turn/interrupt' | 'thread/unsubscribe';
type NotificationMethod = 'initialized';

type SpawnFunction = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio & { stdio: ['pipe', 'pipe', 'pipe'] },
) => ChildProcessWithoutNullStreams;

export interface CodexAuthServiceOptions {
  homeDir: string;
  binaryPath?: string;
  requestTimeoutMs?: number;
  loginTimeoutMs?: number;
  /** Test seam for a supervised process; production callers should leave this unset. */
  spawn?: SpawnFunction;
  /** Test seam for login expiry. */
  now?: () => number;
  /** Test seam for bounded protocol messages. */
  maxMessageBytes?: number;
  /** Test seam for supervised SIGTERM/SIGKILL waits. */
  terminationTimeoutMs?: number;
  /** Account connection remains available when research generation is disabled. */
  generationEnabled?: boolean;
  /** Test seam for the bounded end-to-end research turn. */
  researchTimeoutMs?: number;
  /** Test seam for the locally accepted final JSON size. */
  maxResearchResponseBytes?: number;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface ProcessSession {
  child: ChildProcessWithoutNullStreams;
  pending: Map<number, PendingRequest>;
  buffer: Buffer;
  stopped: boolean;
  exited: boolean;
  exitPromise: Promise<void>;
  resolveExit: () => void;
  stopPromise?: Promise<boolean>;
}

interface LoginAttempt {
  loginId: string;
  verificationUrl: string;
  userCode: string;
  expiresAtMs: number;
}

interface ResearchNotification {
  method: string;
  params: unknown;
}

interface ActiveResearch {
  session: ProcessSession;
  generation: number;
  accountKey: string;
  request: CodexResearchRequest;
  startedAtMs: number;
  threadId: string | null;
  turnId: string | null;
  evidence: ResearchEvidence;
  earlyNotifications: ResearchNotification[];
  resolveCompletion: (turn: Record<string, unknown>) => void;
  rejectCompletion: (error: Error) => void;
  completion: Promise<Record<string, unknown>>;
  rejectInterruption: (error: Error) => void;
  interruption: Promise<never>;
  settled: boolean;
  failureReason?: CodexResearchError;
  cleanupPromise?: Promise<void>;
}

class RpcFailure extends Error {}
class ProtocolFailure extends Error {}

export class CodexAuthService implements CodexResearchClient {
  private readonly homeDir: string;
  private readonly codexHomeDir: string;
  private readonly isolatedHomeDir: string;
  private readonly workingDir: string;
  private readonly binaryPath: string;
  private readonly requestTimeoutMs: number;
  private readonly loginTimeoutMs: number;
  private readonly maxMessageBytes: number;
  private readonly terminationTimeoutMs: number;
  private readonly spawnProcess: SpawnFunction;
  private readonly now: () => number;
  private readonly generationEnabled: boolean;
  private readonly researchTimeoutMs: number;
  private readonly maxResearchResponseBytes: number;

  private session: ProcessSession | null = null;
  private nextRequestId = 1;
  private authGeneration = 0;
  private login: LoginAttempt | null = null;
  private loginTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private terminationBarrier: Promise<boolean> | null = null;
  private terminationFailed = false;
  private mutationTail: Promise<void> = Promise.resolve();
  private status: CodexAccountStatus = unavailable(UNAVAILABLE_ERROR);
  private researchGeneration = 0;
  private researchIdentityHash: string | null = null;
  private researchAccountKey: string | null = null;
  private activeResearch: ActiveResearch | null = null;

  constructor(options: CodexAuthServiceOptions) {
    this.homeDir = path.resolve(options.homeDir);
    this.codexHomeDir = path.join(this.homeDir, 'codex-home');
    this.isolatedHomeDir = path.join(this.homeDir, 'home');
    this.workingDir = path.join(this.homeDir, 'workspace');
    this.binaryPath = options.binaryPath?.trim() || 'codex';
    this.requestTimeoutMs = positiveDuration(options.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
    this.loginTimeoutMs = positiveDuration(options.loginTimeoutMs, DEFAULT_LOGIN_TIMEOUT_MS);
    this.generationEnabled = options.generationEnabled ?? false;
    this.maxMessageBytes = positiveDuration(
      options.maxMessageBytes,
      this.generationEnabled ? DEFAULT_GENERATION_MAX_MESSAGE_BYTES : DEFAULT_MAX_MESSAGE_BYTES,
    );
    this.terminationTimeoutMs = positiveDuration(options.terminationTimeoutMs, DEFAULT_TERMINATION_TIMEOUT_MS);
    this.spawnProcess = options.spawn ?? nodeSpawn;
    this.now = options.now ?? Date.now;
    this.researchTimeoutMs = positiveDuration(options.researchTimeoutMs, DEFAULT_RESEARCH_TIMEOUT_MS);
    this.maxResearchResponseBytes = positiveDuration(
      options.maxResearchResponseBytes,
      DEFAULT_MAX_RESEARCH_RESPONSE_BYTES,
    );
  }

  async getStatus(): Promise<CodexAccountStatus> {
    return this.enqueue(async () => {
      if (this.disposed) return this.disposedStatus();
      if (await this.expireLogin()) return this.snapshot();
      try {
        const session = await this.ensureSession();
        await this.readAccount(session, this.authGeneration);
      } catch {
        await this.failOperation(UNAVAILABLE_ERROR);
      }
      return this.snapshot();
    });
  }

  async startLogin(): Promise<CodexAccountStatus> {
    return this.enqueue(async () => {
      if (this.disposed) return this.disposedStatus();
      if (!(await this.expireLogin()) && this.login) return this.snapshot();

      try {
        const session = await this.ensureSession();
        await this.readAccount(session, this.authGeneration);
        if (this.status.state === 'signed-in') return this.snapshot();
        if (this.status.state === 'unavailable' || session !== this.session) return this.snapshot();
        if (this.login) return this.snapshot();

        const result = asRecord(await this.request(session, 'account/login/start', {
          type: 'chatgptDeviceCode',
        }));
        const attempt = parseLoginAttempt(result, this.now() + this.loginTimeoutMs);
        this.authGeneration += 1;
        await this.rotateResearchAccount();
        this.login = attempt;
        this.scheduleLoginExpiry(attempt);
        this.status = {
          state: 'signing-in',
          account: null,
          login: publicLogin(attempt),
          error: null,
          generationEnabled: false,
        };
        await this.secureCredentialFile();
      } catch {
        await this.failOperation(LOGIN_ERROR);
      }
      return this.snapshot();
    });
  }

  async cancelLogin(loginId: string): Promise<CodexAccountStatus> {
    return this.enqueue(async () => {
      if (this.disposed) return this.disposedStatus();
      if (await this.expireLogin()) return this.snapshot();
      if (!this.login || loginId !== this.login.loginId) return this.snapshot();

      const session = this.session;
      this.authGeneration += 1;
      this.clearLogin();
      this.status = signedOut(null);
      if (!session || !(await this.cancelLoginSession(session, loginId))) {
        this.status = signedOut(CANCEL_ERROR);
      }
      return this.snapshot();
    });
  }

  async logout(): Promise<CodexAccountStatus> {
    return this.enqueue(async () => {
      if (this.disposed) return this.disposedStatus();
      const attempt = this.login;
      this.authGeneration += 1;
      await this.rotateResearchAccount();
      this.clearLogin();
      let session: ProcessSession | null = null;
      try {
        session = await this.ensureSession();
        if (attempt) {
          if (!(await this.cancelLoginSession(session, attempt.loginId))) throw new RpcFailure();
        } else {
          const result = await this.request(session, 'account/logout');
          if (!isRecord(result)) throw new ProtocolFailure();
          await this.secureCredentialFile();
          if (!(await this.stopSession(session))) throw new RpcFailure();
        }
        this.status = signedOut(null);
      } catch {
        await this.stopSession(session);
        this.status = unavailable(LOGOUT_ERROR);
      }
      return this.snapshot();
    });
  }

  async getResearchAccountKey(): Promise<string> {
    try {
      return await this.enqueueValue(async () => {
        const { identityHash } = await this.confirmResearchAccount();
        if (this.researchAccountKey) return this.researchAccountKey;
        const stored = await this.readResearchAccountMetadata();
        const accountKey = stored?.identityHash === identityHash ? stored.accountKey : randomUUID();
        await this.writeResearchAccountMetadata({ identityHash, accountKey });
        this.researchAccountKey = accountKey;
        return accountKey;
      });
    } catch (error) {
      if (error instanceof CodexResearchError) throw error;
      throw new CodexResearchError('unavailable');
    }
  }

  async research(request: CodexResearchRequest): Promise<CodexResearchResult> {
    let run: ActiveResearch;
    try {
      run = await this.enqueueValue(async () => {
        if (!this.generationEnabled || this.disposed) throw new CodexResearchError('unavailable');
        if (this.status.state === 'unavailable') throw new CodexResearchError('unavailable');
        if (this.status.state !== 'signed-in' || !this.researchIdentityHash || !this.researchAccountKey || !this.session) {
          throw new CodexResearchError('not-connected');
        }
        if (request.accountKey !== this.researchAccountKey) throw new CodexResearchError('canceled');
        if (this.activeResearch) throw new CodexResearchError('busy');
        const active = createActiveResearch(
          this.session,
          this.researchGeneration,
          this.researchAccountKey,
          request,
          this.now(),
        );
        this.activeResearch = active;
        return active;
      });
    } catch (error) {
      if (error instanceof CodexResearchError) throw error;
      throw new CodexResearchError('unavailable');
    }

    const abort = () => { void this.terminateResearch(run, true, new CodexResearchError('canceled')); };
    request.signal?.addEventListener('abort', abort, { once: true });
    try {
      if (request.signal?.aborted) throw new CodexResearchError('canceled');
      const operation = this.performResearch(run).catch(async (error: unknown) => {
        await this.terminateResearch(run, true, error instanceof CodexResearchError ? error : undefined);
        throw error;
      });
      return await withDeadline(Promise.race([operation, run.interruption]), this.researchTimeoutMs);
    } catch (error) {
      await this.terminateResearch(run, true, error instanceof CodexResearchError ? error : undefined);
      if (error instanceof CodexResearchError) throw error;
      if (run.failureReason) throw run.failureReason;
      throw new CodexResearchError('invalid-output');
    } finally {
      request.signal?.removeEventListener('abort', abort);
      if (this.activeResearch === run) this.activeResearch = null;
    }
  }

  private async performResearch(run: ActiveResearch): Promise<CodexResearchResult> {
    const { request } = run;
    this.assertResearchCurrent(run);
    await this.requireResearchModel(run.session, request.model);
    this.assertResearchCurrent(run);
    const threadResult = asRecord(await this.researchRpc(run.session, 'thread/start', {
      model: request.model,
      cwd: this.workingDir,
      ephemeral: true,
      environments: [],
      runtimeWorkspaceRoots: [],
      sandbox: 'read-only',
      approvalPolicy: 'never',
      baseInstructions: RESEARCH_BASE_INSTRUCTIONS,
    }));
    run.threadId = boundedString(asRecord(threadResult.thread).id, 1, 128);
    this.replayResearchNotifications(run);
    this.assertResearchCurrent(run);

    const turnResult = asRecord(await this.researchRpc(run.session, 'turn/start', {
      threadId: run.threadId,
      input: [{ type: 'text', text: createResearchPrompt(request) }],
      effort: 'low',
      outputSchema: RESEARCH_OUTPUT_SCHEMA,
    }));
    run.turnId = boundedString(asRecord(turnResult.turn).id, 1, 128);
    this.replayResearchNotifications(run);
    this.assertResearchCurrent(run);

    const turn = await run.completion;
    this.assertResearchCurrent(run);
    if (turn.status !== 'completed') throw new CodexResearchError('invalid-output');
    const durationMs = nonNegativeInteger(turn.durationMs) ?? Math.max(0, this.now() - run.startedAtMs);
    const result = parseResearchResult(run.evidence, request, durationMs, this.maxResearchResponseBytes);
    await this.terminateResearch(run, false);
    this.assertResearchCurrent(run);
    return result;
  }

  async cancelResearch(): Promise<void> {
    const run = this.activeResearch;
    if (!run) return;
    await this.terminateResearch(run, true, new CodexResearchError('canceled'));
    if (this.activeResearch === run) this.activeResearch = null;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.authGeneration += 1;
    this.researchGeneration += 1;
    const research = this.activeResearch;
    if (research) await this.terminateResearch(research, true, new CodexResearchError('canceled'));
    this.clearLogin();
    this.status = unavailable(UNAVAILABLE_ERROR);
    await this.stopSession(this.session);
    await this.mutationTail.catch(() => undefined);
  }

  private enqueue(operation: () => Promise<CodexAccountStatus>): Promise<CodexAccountStatus> {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  private enqueueValue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  private async ensureSession(): Promise<ProcessSession> {
    if (this.disposed || this.terminationFailed) throw new RpcFailure();
    if (this.session) return this.session;
    if (this.terminationBarrier && !(await this.terminationBarrier)) throw new RpcFailure();
    if (this.disposed || this.terminationFailed) throw new RpcFailure();

    await this.prepareDirectories();
    const child = this.spawnProcess(this.binaryPath, ['app-server', '--strict-config'], {
      cwd: this.workingDir,
      env: childEnvironment(this.isolatedHomeDir, this.codexHomeDir),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let resolveExit!: () => void;
    const exitPromise = new Promise<void>((resolve) => { resolveExit = resolve; });
    const session: ProcessSession = {
      child,
      pending: new Map(),
      buffer: Buffer.alloc(0),
      stopped: false,
      exited: false,
      exitPromise,
      resolveExit,
    };
    this.session = session;
    child.stdout.on('data', (chunk: Buffer | string) => this.handleStdout(session, chunk));
    child.stderr.on('data', () => undefined);
    child.stdout.on('error', () => this.failSession(session));
    child.stderr.on('error', () => this.failSession(session));
    const exited = () => this.processExited(session);
    child.on('error', () => {
      if (typeof child.pid === 'number') this.failSession(session);
      else exited();
    });
    child.stdin.on('error', () => this.failSession(session));
    child.once('exit', exited);
    child.once('close', exited);

    try {
      const initialized = await this.request(session, 'initialize', {
        clientInfo: {
          name: 'roon_now_playing',
          title: 'Roon Now Playing',
          version: '1.0.0',
        },
        ...(this.generationEnabled ? { capabilities: { experimentalApi: true } } : {}),
      });
      if (!isRecord(initialized)) throw new ProtocolFailure();
      this.notify(session, 'initialized', {});
      return session;
    } catch (error) {
      await this.stopSession(session);
      throw error;
    }
  }

  private async prepareDirectories(): Promise<void> {
    for (const directory of [this.homeDir, this.codexHomeDir, this.isolatedHomeDir, this.workingDir]) {
      await ensurePrivateDirectory(directory);
    }
    const configPath = path.join(this.codexHomeDir, 'config.toml');
    const config = [
      'cli_auth_credentials_store = "file"',
      'project_doc_max_bytes = 0',
      'check_for_update_on_startup = false',
      ...(this.generationEnabled ? [
        'web_search = "live"',
        'include_environment_context = false',
        'include_collaboration_mode_instructions = false',
        'include_apps_instructions = false',
      ] : []),
      '',
      ...(this.generationEnabled ? ['[agents]', 'enabled = false', ''] : []),
      '[skills]',
      'include_instructions = false',
      '',
      '[skills.bundled]',
      'enabled = false',
      '',
      ...(this.generationEnabled ? [
        '[features]',
        ...RESEARCH_DISABLED_FEATURES.map((feature) => `${feature} = false`),
        '',
      ] : []),
      '[analytics]',
      'enabled = false',
      '',
    ].join('\n');
    const configFile = await fs.open(
      configPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_NOFOLLOW,
      0o600,
    );
    try {
      await ensurePrivateFile(configFile);
      await configFile.truncate(0);
      await configFile.writeFile(config);
      await configFile.chmod(0o600);
    } finally {
      await configFile.close();
    }
    await this.secureCredentialFile();
  }

  private async secureCredentialFile(): Promise<void> {
    let credentialFile: fs.FileHandle | undefined;
    try {
      credentialFile = await fs.open(
        path.join(this.codexHomeDir, 'auth.json'),
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
      await ensurePrivateFile(credentialFile);
      await credentialFile.chmod(0o600);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    } finally {
      await credentialFile?.close();
    }
  }

  private request(session: ProcessSession, method: RpcMethod, params?: unknown): Promise<unknown> {
    if (session !== this.session || session.stopped || session.pending.size >= MAX_PENDING_REQUESTS) {
      throw new RpcFailure();
    }
    const id = this.nextRequestId++;
    const message: Record<string, unknown> = { method, id };
    if (params !== undefined) message.params = params;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!session.pending.delete(id)) return;
        this.failSession(session);
        reject(new RpcFailure());
      }, this.requestTimeoutMs);
      timer.unref?.();
      session.pending.set(id, { resolve, reject, timer });
      this.writeMessage(session, message);
    });
  }

  private notify(session: ProcessSession, method: NotificationMethod, params: unknown): void {
    this.writeMessage(session, { method, params });
  }

  private writeMessage(session: ProcessSession, message: Record<string, unknown>): void {
    if (session !== this.session || session.stopped) throw new RpcFailure();
    const line = `${JSON.stringify(message)}\n`;
    if (Buffer.byteLength(line) > this.maxMessageBytes) throw new ProtocolFailure();
    try {
      session.child.stdin.write(line, (error) => {
        if (error) this.failSession(session);
      });
    } catch {
      this.failSession(session);
      throw new RpcFailure();
    }
  }

  private handleStdout(session: ProcessSession, chunk: Buffer | string): void {
    if (session !== this.session || session.stopped) return;
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    let offset = 0;
    while (offset < bytes.length) {
      const newline = bytes.indexOf(0x0a, offset);
      if (newline < 0) {
        const remainder = bytes.subarray(offset);
        if (session.buffer.length + remainder.length > this.maxMessageBytes) {
          this.failSession(session);
          return;
        }
        session.buffer = Buffer.concat([session.buffer, remainder]);
        return;
      }
      const segment = bytes.subarray(offset, newline);
      if (session.buffer.length + segment.length > this.maxMessageBytes) {
        this.failSession(session);
        return;
      }
      const line = session.buffer.length === 0 ? segment : Buffer.concat([session.buffer, segment]);
      session.buffer = Buffer.alloc(0);
      offset = newline + 1;
      if (line.length === 0) continue;
      try {
        const message: unknown = JSON.parse(line.toString('utf8'));
        this.handleMessage(session, message);
      } catch {
        this.failSession(session);
        return;
      }
    }
  }

  private handleMessage(session: ProcessSession, value: unknown): void {
    const message = asRecord(value);
    if (typeof message.id === 'number' && Number.isSafeInteger(message.id)) {
      if (typeof message.method === 'string') {
        this.writeMessage(session, {
          id: message.id,
          error: { code: -32601, message: 'Method not supported' },
        });
        return;
      }
      const pending = session.pending.get(message.id);
      if (!pending) return;
      session.pending.delete(message.id);
      clearTimeout(pending.timer);
      if ('error' in message) pending.reject(new RpcFailure());
      else if ('result' in message) pending.resolve(message.result);
      else {
        pending.reject(new ProtocolFailure());
        this.failSession(session);
      }
      void this.secureCredentialFile().catch(() => this.failSession(session));
      return;
    }
    if (typeof message.method !== 'string' || 'id' in message) throw new ProtocolFailure();
    this.handleNotification(session, message.method, message.params);
  }

  private handleNotification(session: ProcessSession, method: string, params: unknown): void {
    void this.secureCredentialFile().catch(() => this.failSession(session));
    if (method === 'item/completed' || method === 'turn/completed' || method === 'thread/tokenUsage/updated') {
      this.handleResearchNotification(session, method, params);
      return;
    }
    if (method === 'account/login/completed') {
      if (!isRecord(params)) throw new ProtocolFailure();
      if (params.loginId !== undefined && params.loginId !== null && typeof params.loginId !== 'string') {
        throw new ProtocolFailure();
      }
      const loginId = typeof params.loginId === 'string' ? params.loginId : null;
      if (!this.login || (loginId !== null && loginId !== this.login.loginId)) return;
      if (params.success === false) {
        this.authGeneration += 1;
        this.clearLogin();
        this.status = signedOut(LOGIN_FAILED_ERROR);
        void this.stopSession(session);
      } else if (params.success === true) {
        const generation = this.authGeneration;
        void this.enqueueNotification(session, async () => this.readAccount(session, generation));
      } else {
        throw new ProtocolFailure();
      }
      return;
    }
    if (method === 'account/updated') {
      if (!isRecord(params)) throw new ProtocolFailure();
      if (params.authMode === 'chatgpt' || params.authMode === null) {
        const generation = this.authGeneration;
        void this.enqueueNotification(session, async () => this.readAccount(session, generation));
      } else if (typeof params.authMode === 'string') {
        void this.enqueueNotification(session, async () => {
          this.authGeneration += 1;
          await this.rotateResearchAccount();
          this.clearLogin();
          this.status = unavailable(UNSUPPORTED_ACCOUNT_ERROR);
          await this.stopSession(session);
        });
      } else {
        throw new ProtocolFailure();
      }
    }
  }

  private async enqueueNotification(session: ProcessSession, operation: () => Promise<void>): Promise<void> {
    await this.enqueue(async () => {
      if (this.disposed || session !== this.session || session.stopped) return this.snapshot();
      try {
        await operation();
      } catch {
        await this.failOperation(UNAVAILABLE_ERROR);
      }
      return this.snapshot();
    });
  }

  private async readAccount(session: ProcessSession, generation: number): Promise<void> {
    const result = asRecord(await this.request(session, 'account/read', { refreshToken: false }));
    if (generation !== this.authGeneration || session !== this.session) return;
    if (result.account === null) {
      if (this.researchIdentityHash !== null) await this.rotateResearchAccount();
      this.status = this.login ? {
        state: 'signing-in',
        account: null,
        login: publicLogin(this.login),
        error: null,
        generationEnabled: false,
      } : signedOut(null);
      return;
    }
    const account = asRecord(result.account);
    if (account.type !== 'chatgpt') {
      this.authGeneration += 1;
      await this.rotateResearchAccount();
      this.clearLogin();
      this.status = unavailable(UNSUPPORTED_ACCOUNT_ERROR);
      await this.stopSession(session);
      return;
    }
    const email = nullableBoundedString(account.email, 320);
    const planType = nullableBoundedString(account.planType, 64);
    const identityHash = email === null ? null : hashAccountEmail(email);
    if (this.researchIdentityHash !== null && this.researchIdentityHash !== identityHash) {
      await this.rotateResearchAccount();
    }
    this.researchIdentityHash = identityHash;
    this.authGeneration += 1;
    this.clearLogin();
    this.status = {
      state: 'signed-in',
      account: { email, planType },
      login: null,
      error: null,
      generationEnabled: this.generationEnabled,
    };
  }

  private async confirmResearchAccount(): Promise<{ session: ProcessSession; identityHash: string }> {
    if (!this.generationEnabled || this.disposed) throw new CodexResearchError('unavailable');
    const session = await this.ensureSession();
    await this.readAccount(session, this.authGeneration);
    if (this.status.state !== 'signed-in' || !this.researchIdentityHash || !this.status.account?.email) {
      throw new CodexResearchError('not-connected');
    }
    return { session, identityHash: this.researchIdentityHash };
  }

  private async accountKeyForIdentity(identityHash: string): Promise<string> {
    if (this.researchAccountKey) return this.researchAccountKey;
    const stored = await this.readResearchAccountMetadata();
    const accountKey = stored?.identityHash === identityHash ? stored.accountKey : randomUUID();
    await this.writeResearchAccountMetadata({ identityHash, accountKey });
    this.researchAccountKey = accountKey;
    return accountKey;
  }

  private async requireResearchModel(session: ProcessSession, requestedModel: string): Promise<void> {
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    for (let page = 0; page < MAX_MODEL_PAGES; page += 1) {
      const result = asRecord(await this.researchRpc(session, 'model/list', {
        cursor,
        limit: MODEL_PAGE_SIZE,
        includeHidden: true,
      }));
      if (!Array.isArray(result.data)) throw new CodexResearchError('model-unavailable');
      for (const value of result.data) {
        const model = asRecord(value);
        if (model.model !== requestedModel) continue;
        if (!Array.isArray(model.supportedReasoningEfforts) || !model.supportedReasoningEfforts.some((option) =>
          isRecord(option) && option.reasoningEffort === 'low')) {
          throw new CodexResearchError('model-unavailable');
        }
        return;
      }
      if (result.nextCursor === null || result.nextCursor === undefined) break;
      const nextCursor = boundedString(result.nextCursor, 1, 512);
      if (seenCursors.has(nextCursor)) break;
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }
    throw new CodexResearchError('model-unavailable');
  }

  private async researchRpc(session: ProcessSession, method: RpcMethod, params: unknown): Promise<unknown> {
    try {
      return await this.request(session, method, params);
    } catch {
      throw new CodexResearchError('unavailable');
    }
  }

  private handleResearchNotification(session: ProcessSession, method: string, params: unknown): void {
    const run = this.activeResearch;
    if (!run || run.session !== session || run.settled) return;
    if (!run.threadId || !run.turnId) {
      if (run.earlyNotifications.length >= 512) {
        run.failureReason = new CodexResearchError('invalid-output');
        run.rejectCompletion(run.failureReason);
        run.settled = true;
      } else {
        run.earlyNotifications.push({ method, params });
      }
      return;
    }
    this.applyResearchNotification(run, method, params);
  }

  private replayResearchNotifications(run: ActiveResearch): void {
    if (!run.threadId || !run.turnId || run.settled) return;
    const notifications = run.earlyNotifications.splice(0);
    for (const { method, params } of notifications) this.applyResearchNotification(run, method, params);
  }

  private applyResearchNotification(run: ActiveResearch, method: string, value: unknown): void {
    const params = asRecord(value);
    if (params.threadId !== run.threadId) return;
    if (method === 'item/completed') {
      if (params.turnId !== run.turnId) return;
      collectResearchItem(run.evidence, params.item);
      return;
    }
    if (method === 'thread/tokenUsage/updated') {
      if (params.turnId !== run.turnId) return;
      collectResearchUsage(run.evidence, params);
      return;
    }
    if (method !== 'turn/completed') return;
    const turn = asRecord(params.turn);
    if (turn.id !== run.turnId) return;
    run.settled = true;
    if (turn.status === 'completed') run.resolveCompletion(turn);
    else {
      run.failureReason = new CodexResearchError('invalid-output');
      run.rejectCompletion(run.failureReason);
    }
  }

  private assertResearchCurrent(run: ActiveResearch): void {
    if (run.failureReason) throw run.failureReason;
    if (run.generation !== this.researchGeneration || run !== this.activeResearch ||
        run.session !== this.session || run.accountKey !== this.researchAccountKey) {
      throw new CodexResearchError('canceled');
    }
  }

  private terminateResearch(run: ActiveResearch, interrupt: boolean, reason?: CodexResearchError): Promise<void> {
    if (run.cleanupPromise) return run.cleanupPromise;
    if (reason && !run.failureReason) {
      run.failureReason = reason;
      run.rejectInterruption(reason);
    }
    run.settled = true;
    run.rejectCompletion(reason ?? new CodexResearchError('invalid-output'));
    // A thread/start response can arrive after cancellation. Leave cleanup open
    // so performResearch can unsubscribe the newly known thread at that point.
    if (!run.threadId) return Promise.resolve();
    run.cleanupPromise = (async () => {
      if (run.session !== this.session || run.session.stopped) return;
      try {
        if (interrupt && run.threadId && run.turnId) {
          await this.request(run.session, 'turn/interrupt', { threadId: run.threadId, turnId: run.turnId });
        }
        await this.request(run.session, 'thread/unsubscribe', { threadId: run.threadId });
      } catch {
        await this.stopSession(run.session);
      }
    })();
    return run.cleanupPromise;
  }

  private async rotateResearchAccount(): Promise<void> {
    this.researchGeneration += 1;
    const run = this.activeResearch;
    this.activeResearch = null;
    this.researchIdentityHash = null;
    this.researchAccountKey = null;
    if (run) void this.terminateResearch(run, true, new CodexResearchError('canceled'));
    try { await fs.unlink(path.join(this.homeDir, 'research-account.json')); } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }

  private async readResearchAccountMetadata(): Promise<{ identityHash: string; accountKey: string } | null> {
    let file: fs.FileHandle | undefined;
    try {
      file = await fs.open(path.join(this.homeDir, 'research-account.json'), fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
      await ensurePrivateFile(file);
      if ((await file.stat()).size > 4_096) throw new ProtocolFailure();
      const value: unknown = JSON.parse(await file.readFile('utf8'));
      const metadata = asRecord(value);
      return {
        identityHash: boundedString(metadata.identityHash, 64, 64, /^[a-f0-9]{64}$/),
        accountKey: boundedString(
          metadata.accountKey,
          36,
          36,
          /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
        ),
      };
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    } finally {
      await file?.close();
    }
  }

  private async writeResearchAccountMetadata(metadata: { identityHash: string; accountKey: string }): Promise<void> {
    const target = path.join(this.homeDir, 'research-account.json');
    const temporary = path.join(this.homeDir, `.research-account-${randomUUID()}.tmp`);
    const file = await fs.open(temporary, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, 0o600);
    try {
      await file.writeFile(`${JSON.stringify(metadata)}\n`);
      await file.chmod(0o600);
    } finally {
      await file.close();
    }
    try {
      await fs.rename(temporary, target);
    } catch (error) {
      await fs.unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  private async expireLogin(): Promise<boolean> {
    const attempt = this.login;
    if (!attempt || this.now() < attempt.expiresAtMs) return false;
    this.authGeneration += 1;
    this.clearLogin();
    this.status = signedOut(LOGIN_EXPIRED_ERROR);
    const session = this.session;
    if (session) {
      await this.cancelLoginSession(session, attempt.loginId);
    }
    return true;
  }

  private async cancelLoginSession(session: ProcessSession, loginId: string): Promise<boolean> {
    let canceled = false;
    let loggedOut = false;
    try {
      const cancellation = asRecord(await this.request(session, 'account/login/cancel', { loginId }));
      canceled = cancellation.status === 'canceled' || cancellation.status === 'notFound';
      if (!canceled) throw new ProtocolFailure();
      const logout = await this.request(session, 'account/logout');
      if (!isRecord(logout)) throw new ProtocolFailure();
      await this.secureCredentialFile();
      loggedOut = true;
    } catch {
      // Termination below prevents this app-server from completing the old flow later.
    }
    const stopped = await this.stopSession(session);
    return canceled && loggedOut && stopped;
  }

  private async failOperation(error: string): Promise<void> {
    this.authGeneration += 1;
    this.researchGeneration += 1;
    const research = this.activeResearch;
    this.activeResearch = null;
    if (research) void this.terminateResearch(research, true, new CodexResearchError('unavailable'));
    this.clearLogin();
    await this.stopSession(this.session);
    this.status = unavailable(error);
  }

  private failSession(session: ProcessSession): void {
    if (session.stopped) return;
    const wasCurrent = this.session === session;
    void this.stopSession(session);
    if (wasCurrent && !this.disposed) {
      this.authGeneration += 1;
      this.researchGeneration += 1;
      const research = this.activeResearch;
      this.activeResearch = null;
      if (research) void this.terminateResearch(research, true, new CodexResearchError('unavailable'));
      this.clearLogin();
      this.status = unavailable(UNAVAILABLE_ERROR);
    }
  }

  private stopSession(session: ProcessSession | null): Promise<boolean> {
    if (!session) return this.terminationBarrier ?? Promise.resolve(true);
    if (session.stopPromise) return session.stopPromise;
    session.stopped = true;
    if (this.session === session) this.session = null;
    for (const pending of session.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new RpcFailure());
    }
    session.pending.clear();
    try { session.child.stdin.end(); } catch { /* already closed */ }
    session.stopPromise = this.terminateProcess(session);
    this.terminationBarrier = session.stopPromise;
    void session.stopPromise.then((stopped) => {
      if (!stopped) this.terminationFailed = true;
      if (this.terminationBarrier === session.stopPromise) this.terminationBarrier = null;
    });
    return session.stopPromise;
  }

  private async terminateProcess(session: ProcessSession): Promise<boolean> {
    if (session.exited) return true;
    try { session.child.kill('SIGTERM'); } catch { /* exit wait decides the outcome */ }
    if (await waitForExit(session, this.terminationTimeoutMs)) return true;
    try { session.child.kill('SIGKILL'); } catch { /* exit wait decides the outcome */ }
    return waitForExit(session, this.terminationTimeoutMs);
  }

  private processExited(session: ProcessSession): void {
    if (!session.exited) {
      session.exited = true;
      session.resolveExit();
    }
    if (!session.stopped) this.failSession(session);
  }

  private scheduleLoginExpiry(attempt: LoginAttempt): void {
    if (this.loginTimer) clearTimeout(this.loginTimer);
    this.loginTimer = setTimeout(() => {
      void this.enqueue(async () => {
        if (!this.disposed && this.login === attempt) {
          const expired = await this.expireLogin();
          // Timer callbacks can arrive before the wall clock reaches the deadline.
          if (!expired && !this.disposed && this.login === attempt) this.scheduleLoginExpiry(attempt);
        }
        return this.snapshot();
      });
    }, Math.max(0, attempt.expiresAtMs - this.now()));
    this.loginTimer.unref?.();
  }

  private clearLogin(): void {
    this.login = null;
    if (this.loginTimer) clearTimeout(this.loginTimer);
    this.loginTimer = null;
  }

  private disposedStatus(): CodexAccountStatus {
    this.status = unavailable(UNAVAILABLE_ERROR);
    return this.snapshot();
  }

  private snapshot(): CodexAccountStatus {
    return {
      ...this.status,
      generationEnabled: this.generationEnabled,
      account: this.status.account ? { ...this.status.account } : null,
      login: this.status.login ? { ...this.status.login } : null,
    };
  }
}

function parseLoginAttempt(result: Record<string, unknown>, expiresAtMs: number): LoginAttempt {
  if (result.type !== 'chatgptDeviceCode') throw new ProtocolFailure();
  const loginId = boundedString(result.loginId, 1, 128, /^[A-Za-z0-9_-]+$/);
  const userCode = boundedString(result.userCode, 4, 32, /^[A-Z0-9-]+$/);
  const verificationUrl = boundedString(result.verificationUrl, 1, 256);
  let url: URL;
  try {
    url = new URL(verificationUrl);
  } catch {
    throw new ProtocolFailure();
  }
  if (verificationUrl !== 'https://auth.openai.com/codex/device' ||
      url.href !== 'https://auth.openai.com/codex/device') {
    throw new ProtocolFailure();
  }
  return { loginId, verificationUrl: url.href, userCode, expiresAtMs };
}

function publicLogin(attempt: LoginAttempt): NonNullable<CodexAccountStatus['login']> {
  return {
    loginId: attempt.loginId,
    verificationUrl: attempt.verificationUrl,
    userCode: attempt.userCode,
    expiresAt: new Date(attempt.expiresAtMs).toISOString(),
  };
}

function childEnvironment(homeDir: string, codexHomeDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    HOME: homeDir,
    CODEX_HOME: codexHomeDir,
    NO_COLOR: '1',
  };
  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'PATHEXT', 'COMSPEC'] as const) {
    const value = process.env[name];
    if (typeof value === 'string') env[name] = value;
  }
  return env;
}

function unavailable(error: string): CodexAccountStatus {
  return { state: 'unavailable', account: null, login: null, error, generationEnabled: false };
}

function signedOut(error: string | null): CodexAccountStatus {
  return { state: 'signed-out', account: null, login: null, error, generationEnabled: false };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new ProtocolFailure();
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, min: number, max: number, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length < min || value.length > max ||
      hasControlCharacter(value) || (pattern && !pattern.test(value))) {
    throw new ProtocolFailure();
  }
  return value;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function nullableBoundedString(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  return boundedString(value, 0, max);
}

function positiveDuration(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}

async function ensurePrivateDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ProtocolFailure();
  await fs.chmod(directory, 0o700);
}

async function ensurePrivateFile(file: fs.FileHandle): Promise<void> {
  const stat = await file.stat();
  const wrongOwner = typeof process.getuid === 'function' && stat.uid !== process.getuid();
  if (!stat.isFile() || stat.nlink !== 1 || wrongOwner) throw new ProtocolFailure();
}

async function waitForExit(session: ProcessSession, timeoutMs: number): Promise<boolean> {
  if (session.exited) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref?.();
  });
  const exited = session.exitPromise.then(() => true as const);
  const result = await Promise.race([exited, timedOut]);
  if (timer) clearTimeout(timer);
  return result;
}

function createActiveResearch(
  session: ProcessSession,
  generation: number,
  accountKey: string,
  request: CodexResearchRequest,
  startedAtMs: number,
): ActiveResearch {
  let resolveCompletion!: (turn: Record<string, unknown>) => void;
  let rejectCompletion!: (error: Error) => void;
  const completion = new Promise<Record<string, unknown>>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });
  void completion.catch(() => undefined);
  let rejectInterruption!: (error: Error) => void;
  const interruption = new Promise<never>((_resolve, reject) => { rejectInterruption = reject; });
  void interruption.catch(() => undefined);
  return {
    session,
    generation,
    accountKey,
    request,
    startedAtMs,
    threadId: null,
    turnId: null,
    evidence: {
      finalMessages: [],
      openedUrls: new Set(),
      webSearches: 0,
      openPages: 0,
    },
    earlyNotifications: [],
    resolveCompletion,
    rejectCompletion,
    completion,
    rejectInterruption,
    interruption,
    settled: false,
  };
}

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new CodexResearchError('timeout')), timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function hashAccountEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase(), 'utf8').digest('hex');
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
