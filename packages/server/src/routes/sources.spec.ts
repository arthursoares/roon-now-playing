// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';
import fs from 'fs';
import { ExternalSourceManager } from '../externalSources.js';
import { SourcesConfigStore } from '../sourcesConfig.js';
import { createSourcesRouter } from './sources.js';

const CONFIG_FILE = './test-sources-router-config.json';
const ZONES_FILE = './test-sources-router-zones.json';

describe('sources config authentication', () => {
  let server: Server | undefined;
  let manager: ExternalSourceManager | undefined;

  afterEach(async () => {
    manager?.stopTimeoutChecker();
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    for (const file of [CONFIG_FILE, ZONES_FILE]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  it('rejects enabling key authentication until a key exists', async () => {
    const api = await startApi();
    const response = await fetch(`${api}/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requireApiKey: true }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/generate/i);
  });

  it('protects config changes and key rotation once authentication is enabled', async () => {
    const api = await startApi();
    const generated = await fetch(`${api}/config/generate-key`, { method: 'POST' });
    const { apiKey } = await generated.json() as { apiKey: string };

    expect((await fetch(`${api}/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requireApiKey: true }),
    })).status).toBe(401);
    expect((await fetch(`${api}/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'wrong-key' },
      body: JSON.stringify({ requireApiKey: true }),
    })).status).toBe(401);
    expect((await fetch(`${api}/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ requireApiKey: true }),
    })).status).toBe(200);

    expect((await fetch(`${api}/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requireApiKey: false }),
    })).status).toBe(401);
    expect((await fetch(`${api}/config/generate-key`, { method: 'POST' })).status).toBe(401);

    const rotated = await fetch(`${api}/config/generate-key`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
    });
    expect(rotated.status).toBe(200);
    const { apiKey: rotatedApiKey } = await rotated.json() as { apiKey: string };
    expect(rotatedApiKey).not.toBe(apiKey);

    const disabled = await fetch(`${api}/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': rotatedApiKey },
      body: JSON.stringify({ requireApiKey: false }),
    });
    expect(disabled.status).toBe(200);
  });

  async function startApi(): Promise<string> {
    const app = express();
    app.use(express.json());
    manager = new ExternalSourceManager(ZONES_FILE);
    app.use('/api/sources', createSourcesRouter(manager, new SourcesConfigStore(CONFIG_FILE)));
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/sources`;
  }
});
