// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { WebSocketManager } from './websocket.js';

describe('admin display settings route', () => {
  let server: Server | undefined;
  let dataDir: string | undefined;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('validates and broadcasts partial smart idle updates while preserving other values', async () => {
    const broadcastDisplaySettings = vi.fn();
    const baseUrl = await start(broadcastDisplaySettings);

    const response = await fetch(`${baseUrl}/display-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleMode: 'clock', idleDelayMinutes: 8 }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      fontScale: 1,
      artworkScale: 100,
      idleMode: 'clock',
      idleDelayMinutes: 8,
    });
    expect(broadcastDisplaySettings).toHaveBeenCalledWith(expect.objectContaining({ idleMode: 'clock' }));

    const saved = JSON.parse(fs.readFileSync(path.join(dataDir!, 'display-settings.json'), 'utf8'));
    expect(saved).toMatchObject({ idleMode: 'clock', idleDelayMinutes: 8, nightDimmingEnabled: false });
  });

  it('rejects an invalid idle layout without saving or broadcasting', async () => {
    const broadcastDisplaySettings = vi.fn();
    const baseUrl = await start(broadcastDisplaySettings);
    const response = await fetch(`${baseUrl}/display-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleLayout: 'unknown' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({
      error: expect.stringContaining('idleLayout must be one of'),
    }));
    expect(broadcastDisplaySettings).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(dataDir!, 'display-settings.json'))).toBe(false);
  });

  it('returns 500 and skips broadcast when persistence fails', async () => {
    const broadcastDisplaySettings = vi.fn();
    const baseUrl = await start(broadcastDisplaySettings);
    vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    const response = await fetch(`${baseUrl}/display-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idleMode: 'black' }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to save display settings' });
    expect(broadcastDisplaySettings).not.toHaveBeenCalled();
  });

  it('accepts a lone false interaction lock setting', async () => {
    const pushSettingsToClient = vi.fn().mockReturnValue(true);
    const baseUrl = await start(vi.fn(), pushSettingsToClient);

    const response = await fetch(`${baseUrl}/clients/client-1/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lockInteractions: false }),
    });

    expect(response.status).toBe(200);
    expect(pushSettingsToClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
      lockInteractions: false,
    }));
  });

  it('rejects a non-boolean interaction lock setting', async () => {
    const pushSettingsToClient = vi.fn();
    const baseUrl = await start(vi.fn(), pushSettingsToClient);

    const response = await fetch(`${baseUrl}/clients/client-1/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lockInteractions: 'false' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'lockInteractions must be a boolean' });
    expect(pushSettingsToClient).not.toHaveBeenCalled();
  });

  async function start(
    broadcastDisplaySettings: ReturnType<typeof vi.fn>,
    pushSettingsToClient: ReturnType<typeof vi.fn> = vi.fn(),
  ): Promise<string> {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roon-admin-display-'));
    vi.stubEnv('DATA_DIR', dataDir);
    vi.resetModules();
    const { createAdminRouter } = await import('./admin.js');
    const app = express();
    app.use(express.json());
    app.use('/api/admin', createAdminRouter({
      broadcastDisplaySettings,
      pushSettingsToClient,
    } as unknown as WebSocketManager));
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP server address');
    return `http://127.0.0.1:${address.port}/api/admin`;
  }
});
