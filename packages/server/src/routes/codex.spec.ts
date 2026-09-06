// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { CodexAccountStatus } from '@roon-screen-cover/shared';
import { createCodexAccountRouter } from './codex.js';

const adminToken = 'dedicated-account-admin-token-0123456789';
const status: CodexAccountStatus = {
  state: 'signed-out', account: null, login: null, error: null, generationEnabled: false,
};

describe('Codex account route authorization', () => {
  let server: Server | undefined;
  const service = {
    getStatus: vi.fn(async () => status), startLogin: vi.fn(async () => status),
    cancelLogin: vi.fn(async () => status), logout: vi.fn(async () => status),
  };
  afterEach(async () => {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
    vi.clearAllMocks();
  });
  async function start(token: string | undefined = adminToken, withService = true): Promise<string> {
    const app = express();
    app.use(express.json());
    app.use('/api/codex', createCodexAccountRouter({ service: withService ? service : null, adminToken: token }));
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/codex`;
  }
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };

  it('exposes only capability flags without starting Codex', async () => {
    const base = await start();
    const response = await fetch(`${base}/capabilities`);
    expect(await response.json()).toEqual({ enabled: true, generationEnabled: false });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(service.getStatus).not.toHaveBeenCalled();
  });

  it.each(['/account', '/login', '/login/cancel', '/logout'])('protects %s against public or source-key access', async endpoint => {
    const base = await start();
    const credentials: Record<string, string>[] = [{}, { 'x-api-key': adminToken }, { authorization: 'Bearer wrong-token' }];
    for (const key of credentials) {
      const response = await fetch(`${base}${endpoint}`, {
        method: endpoint === '/account' ? 'GET' : 'POST', headers: key,
      });
      expect(response.status).toBe(401);
    }
    for (const method of Object.values(service)) expect(method).not.toHaveBeenCalled();
  });

  it.each(['', 'too-short', 'contains whitespace token of enough length'])('fails closed for invalid administrator token %j', async token => {
    const base = await start(token);
    expect(await (await fetch(`${base}/capabilities`)).json()).toEqual({ enabled: false, generationEnabled: false });
    expect((await fetch(`${base}/login`, { method: 'POST', headers })).status).toBe(503);
    expect(service.startLogin).not.toHaveBeenCalled();
  });

  it('keeps endpoints unavailable without an enabled service', async () => {
    const base = await start(adminToken, false);
    expect((await fetch(`${base}/account`, { headers })).status).toBe(503);
  });

  it('performs only the requested account operation and makes responses uncacheable', async () => {
    const base = await start();
    const response = await fetch(`${base}/account`, { headers });
    expect(await response.json()).toEqual(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('vary')).toContain('Authorization');
    expect(service.getStatus).toHaveBeenCalledOnce();
    expect((await fetch(`${base}/login`, { method: 'POST', headers, body: '{}' })).status).toBe(200);
    expect((await fetch(`${base}/login/cancel`, { method: 'POST', headers, body: '{"loginId":"attempt-1"}' })).status).toBe(200);
    expect(service.cancelLogin).toHaveBeenCalledWith('attempt-1');
    expect((await fetch(`${base}/logout`, { method: 'POST', headers, body: '{}' })).status).toBe(200);
    expect(service.startLogin).toHaveBeenCalledOnce();
    expect(service.logout).toHaveBeenCalledOnce();
  });

  it('rejects foreign browser origins while accepting its own origin', async () => {
    const base = await start();
    for (const origin of ['https://foreign.example', 'null', `${new URL(base).origin}/extra`]) {
      expect((await fetch(`${base}/login`, { method: 'POST', headers: { ...headers, origin }, body: '{}' })).status).toBe(403);
    }
    expect(service.startLogin).not.toHaveBeenCalled();
    expect((await fetch(`${base}/login`, { method: 'POST', headers: { ...headers, origin: new URL(base).origin }, body: '{}' })).status).toBe(200);
  });

  it.each([
    ['/login', { type: 'apiKey', apiKey: 'private' }],
    ['/login', { method: 'turn/start' }], ['/logout', { arbitrary: true }],
    ['/login/cancel', {}], ['/login/cancel', { loginId: '' }],
    ['/login/cancel', { loginId: 'id', arbitrary: true }], ['/login', []],
  ])('rejects unexpected payloads on %s', async (endpoint, body) => {
    const base = await start();
    expect((await fetch(`${base}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) })).status).toBe(400);
    for (const method of Object.values(service)) expect(method).not.toHaveBeenCalled();
  });

  it('does not forward raw protocol errors or secrets to browsers', async () => {
    service.startLogin.mockRejectedValueOnce(new Error('secret OAuth token and local filesystem path'));
    const base = await start();
    const response = await fetch(`${base}/login`, { method: 'POST', headers, body: '{}' });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/secret|OAuth token|filesystem/);
  });
});
