// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { WebSocketManager } from './websocket.js';
import { ClientSettingsStore } from './clientSettings.js';
import fs from 'fs';
import { DEFAULT_DISPLAY_SETTINGS } from '@roon-screen-cover/shared';

const TEST_FILE = './test-websocket-client-settings.json';

describe('WebSocketManager settings replay', () => {
  let server: Server | undefined;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    for (const socket of sockets) socket.close();
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
  });

  it('replays all persisted overrides when a display reconnects', async () => {
    server = createServer();
    const manager = new WebSocketManager(server, null);
    manager.setClientSettingsStore(new ClientSettingsStore(TEST_FILE));
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    const first = await connect(`ws://127.0.0.1:${port}/ws`, sockets);
    await vi.waitFor(() => expect(first.messages).toContainEqual({
      type: 'display_settings_update',
      settings: expect.objectContaining({
        idleMode: DEFAULT_DISPLAY_SETTINGS.idleMode,
        idleDelayMinutes: DEFAULT_DISPLAY_SETTINGS.idleDelayMinutes,
        nightDimmingEnabled: DEFAULT_DISPLAY_SETTINGS.nightDimmingEnabled,
      }),
    }));
    first.socket.send(JSON.stringify(metadata('screen:one')));
    await vi.waitFor(() => expect(manager.getClientById('screen:one')).toBeDefined());

    expect(manager.pushSettingsToClient('screen:one', {
      artworkScaleOverride: 68,
      enabledLayouts: ['ambient', 'cover'],
    })).toBe(true);
    first.socket.close();
    await new Promise<void>((resolve) => first.socket.once('close', () => resolve()));

    const second = await connect(`ws://127.0.0.1:${port}/ws`, sockets);
    second.socket.send(JSON.stringify(metadata('screen:two')));

    await vi.waitFor(() => {
      expect(second.messages).toContainEqual(expect.objectContaining({
        type: 'remote_settings',
        artworkScaleOverride: 68,
        enabledLayouts: ['ambient', 'cover'],
      }));
    });

    const updatedSettings = { ...DEFAULT_DISPLAY_SETTINGS, idleMode: 'black' as const, idleDelayMinutes: 9 };
    manager.broadcastDisplaySettings(updatedSettings);
    await vi.waitFor(() => expect(second.messages).toContainEqual({
      type: 'display_settings_update',
      settings: updatedSettings,
    }));
  });

  it('replays authoritative null overrides on first registration', async () => {
    const store = new ClientSettingsStore(TEST_FILE);
    store.set('screen', {
      layout: 'detailed',
      font: 'system',
      background: 'black',
      zoneId: null,
      zoneName: null,
      fontScaleOverride: null,
      artworkScaleOverride: null,
      enabledLayouts: null,
    });
    server = createServer();
    const manager = new WebSocketManager(server, null);
    manager.setClientSettingsStore(store);
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    const client = await connect(`ws://127.0.0.1:${port}/ws`, sockets);
    client.socket.send(JSON.stringify(metadata('screen:new-session')));

    await vi.waitFor(() => {
      expect(client.messages).toContainEqual(expect.objectContaining({
        type: 'remote_settings',
        fontScaleOverride: null,
        artworkScaleOverride: null,
        enabledLayouts: null,
      }));
    });
  });
});

function metadata(clientId: string) {
  return {
    type: 'client_metadata',
    clientId,
    layout: 'detailed',
    font: 'system',
    background: 'black',
    zoneId: null,
    zoneName: null,
    userAgent: null,
  };
}

async function connect(url: string, sockets: WebSocket[]) {
  const socket = new WebSocket(url);
  sockets.push(socket);
  const messages: unknown[] = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  return { socket, messages };
}
