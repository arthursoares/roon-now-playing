// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { WebSocket } from 'ws';
import { WebSocketManager } from './websocket.js';
import { ClientSettingsStore } from './clientSettings.js';
import { createAdminRouter } from './admin.js';

describe('admin observers and display sessions', () => {
  let server: Server;
  let manager: WebSocketManager;
  let base: string;
  let directory: string;
  let names: Map<string, string>;
  let store: ClientSettingsStore;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  async function setup() {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'roon-roles-'));
    names = new Map([['screen', 'living-room'], ['historical-admin', 'old-admin-name']]);
    const app = express();
    app.use(express.json());
    server = createServer(app);
    manager = new WebSocketManager(server, null);
    manager.loadFriendlyNames(names);
    manager.setFriendlyNameChangeCallback((id, name) => {
      if (name) names.set(id, name);
      else names.delete(id);
      fs.writeFileSync(path.join(directory, 'names.json'), JSON.stringify(Object.fromEntries(names)));
    });
    store = new ClientSettingsStore(path.join(directory, 'settings.json'));
    manager.setClientSettingsStore(store);
    app.use('/api/admin', createAdminRouter(manager));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  async function connect(id: string, admin = false, reportedAdmin = admin) {
    const socket = new WebSocket(`${base.replace('http:', 'ws:')}/ws${admin ? '?admin=true' : ''}`);
    sockets.push(socket);
    const messages: Record<string, unknown>[] = [];
    socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    socket.send(JSON.stringify(metadata(id, reportedAdmin)));
    await vi.waitFor(() => expect(messages.filter((m) => m.type === 'connection')).toHaveLength(2));
    return { socket, messages };
  }

  it('never registers or persists admins, including query role with conflicting metadata', async () => {
    await setup();
    const admin = await connect('fresh-admin:one', true, false);
    await connect('historical-admin:two', true);
    expect([...names.entries()]).toEqual([['screen', 'living-room'], ['historical-admin', 'old-admin-name']]);
    expect(fs.existsSync(path.join(directory, 'names.json'))).toBe(false);
    expect(store.get('fresh-admin')).toBeNull();
    expect(manager.getAllClientsMetadata()).toEqual([]);
    expect(await (await fetch(`${base}/api/admin/clients`)).json()).toEqual({ clients: [] });
    expect(manager.getClientById('fresh-admin:one')).toBeUndefined();
    expect(manager.getClientByFriendlyName('old-admin-name')).toBeNull();
    expect(admin.messages.filter((m) => ['client_connected', 'client_updated', 'client_disconnected'].includes(String(m.type)))).toEqual([]);
    admin.socket.send(JSON.stringify({ type: 'subscribe', zone_id: 'missing' }));
    admin.socket.send(JSON.stringify({ type: 'unsubscribe' }));
    await vi.waitFor(() => expect(admin.messages.some((m) => m.type === 'album_history')).toBe(true));
    expect(admin.messages.some((m) => m.type === 'client_updated')).toBe(false);
    admin.socket.close();
    await new Promise<void>((resolve) => admin.socket.once('close', resolve));
    await connect('fresh-admin:reconnected', true);
    expect(manager.getAllClientsMetadata()).toEqual([]);
    expect(names.has('fresh-admin')).toBe(false);
    expect((await fetch(`${base}/api/admin/clients/historical-admin`, { method: 'DELETE' })).status).toBe(404);
    expect(names.get('historical-admin')).toBe('old-admin-name');
  });

  it('keeps same-browser admins out of fanout, reset and reconnect selection while controls work', async () => {
    await setup();
    const display = await connect('screen:one');
    const admin = await connect('screen:admin', true);
    const initial = admin.messages.find((m) => m.type === 'clients_list');
    expect(initial?.clients).toEqual([expect.objectContaining({ clientId: 'screen:one', friendlyName: 'living-room' })]);
    expect(manager.getAllClientsMetadata().map((m) => m.clientId)).toEqual(['screen:one']);
    const response = await fetch(`${base}/api/admin/clients/screen%3Aone/push`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: 'cover', lockInteractions: true }),
    });
    expect(response.status).toBe(200);
    await vi.waitFor(() => expect(display.messages).toContainEqual(expect.objectContaining({ type: 'remote_settings', layout: 'cover' })));
    expect(admin.messages.some((m) => m.type === 'remote_settings')).toBe(false);
    expect((await fetch(`${base}/api/admin/clients/screen%3Aone/name`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'renamed-room' }),
    })).status).toBe(200);
    expect((await (await fetch(`${base}/api/admin/screens/renamed-room`)).json()).client.clientId).toBe('screen:one');
    expect(names.get('screen')).toBe('renamed-room');
    expect(store.get('screen')?.layout).toBe('cover');
    const sibling = await connect('screen:two');
    expect(sibling.messages).toContainEqual(expect.objectContaining({ type: 'remote_settings', layout: 'cover', lockInteractions: true }));
    display.socket.close();
    await new Promise<void>((resolve) => display.socket.once('close', resolve));
    await vi.waitFor(() => expect(manager.getAllClientsMetadata().map((m) => m.clientId)).toEqual(['screen:two']));
    sibling.socket.close();
    await new Promise<void>((resolve) => sibling.socket.once('close', resolve));
    await vi.waitFor(() => expect(admin.messages).toContainEqual({ type: 'client_disconnected', clientId: 'screen:two' }));
    expect(manager.getAllClientsMetadata()).toEqual([]);
    const reconnect = await connect('screen:three');
    expect(manager.getAllClientsMetadata()[0].friendlyName).toBe('renamed-room');
    expect(reconnect.messages).toContainEqual(expect.objectContaining({ type: 'remote_settings', layout: 'cover' }));
    expect((await fetch(`${base}/api/admin/clients/screen%3Athree`, { method: 'DELETE' })).status).toBe(200);
    await vi.waitFor(() => expect(reconnect.messages).toContainEqual({ type: 'client_reset' }));
    expect(admin.socket.readyState).toBe(WebSocket.OPEN);
    expect(admin.messages.some((m) => m.type === 'client_reset')).toBe(false);
  });

  it('does not let a closing older connection unregister the replacement with the same session ID', async () => {
    await setup();
    const older = await connect('screen:same');
    const newer = await connect('screen:same');
    older.socket.close();
    await new Promise<void>((resolve) => older.socket.once('close', resolve));
    await vi.waitFor(() => expect(manager.getConnectedClientCount()).toBe(1));
    expect(manager.pushSettingsToClient('screen:same', { layout: 'cover' })).toBe(true);
    await vi.waitFor(() => expect(newer.messages).toContainEqual(expect.objectContaining({ type: 'remote_settings', layout: 'cover' })));
  });

  it('removes display indexing when metadata declares an admin and never demotes the observer', async () => {
    await setup();
    const client = await connect('screen:role');
    client.socket.send(JSON.stringify(metadata('screen:role', true)));
    await vi.waitFor(() => expect(manager.getAllClientsMetadata()).toEqual([]));
    expect(manager.getClientById('screen:role')).toBeUndefined();
    client.socket.send(JSON.stringify(metadata('screen:role', false)));
    await vi.waitFor(() => expect(client.messages.filter((m) => m.type === 'connection')).toHaveLength(4));
    expect(manager.getAllClientsMetadata()).toEqual([]);
    expect(manager.setClientFriendlyName('screen:role', 'admin-name')).toBe(false);
    expect(names.get('screen')).toBe('living-room');
  });

  it('closes idempotently and ignores metadata queued after shutdown begins', async () => {
    await setup();
    const client = await connect('screen:shutdown');
    const persisted = fs.readFileSync(path.join(directory, 'settings.json'), 'utf8');
    const closed = manager.close();
    expect(manager.close()).toBe(closed);
    client.socket.send(JSON.stringify(metadata('late-device:session', false)));
    await closed;
    expect(names.has('late-device')).toBe(false);
    expect(fs.readFileSync(path.join(directory, 'settings.json'), 'utf8')).toBe(persisted);
    expect(manager.getAllClientsMetadata()).toEqual([]);
  });
});

function metadata(clientId: string, isAdmin: boolean) {
  return { type: 'client_metadata', clientId, isAdmin, layout: 'detailed', font: 'system', background: 'black', zoneId: null, zoneName: null, userAgent: null };
}
