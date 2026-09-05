import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import type { NowPlaying, ServerMessage } from '@roon-screen-cover/shared';
import type { RoonClient } from './roon.js';
import { AlbumHistoryStore } from './albumHistory.js';
import { ExternalSourceManager } from './externalSources.js';
import { WebSocketManager } from './websocket.js';

describe.each(['roon', 'external'] as const)('Album Wall with %s playback', (source) => {
  let server: Server;
  let external: ExternalSourceManager;
  let directory: string;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate();
    external?.stopTimeoutChecker();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  it('collects before a display joins, broadcasts only its zone, and replays persisted history', async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'roon-history-ws-'));
    const historyFile = path.join(directory, 'album-history.json');
    const store = new AlbumHistoryStore(historyFile);
    const roon = Object.assign(new EventEmitter(), {
      getZones: () => [{ id: 'room', display_name: 'Room' }],
      getNowPlaying: () => null,
      isConnected: () => true,
    });
    external = new ExternalSourceManager(path.join(directory, 'external-zones.json'));
    server = createServer();
    const manager = new WebSocketManager(server, source === 'roon' ? roon as unknown as RoonClient : null);
    manager.setAlbumHistoryStore(store);
    manager.setExternalSourceManager(external);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    async function play(album: string, zone = 'room') {
      if (source === 'external') {
        await external.updateZone(zone, {
          zone_name: zone, state: 'playing', title: 'Song', artist: 'Artist', album,
        });
      } else {
        const nowPlaying: NowPlaying = {
          zone_id: zone, state: 'playing', seek_position: 0,
          track: { title: 'Song', artist: 'Artist', album, duration_seconds: 120, artwork_key: null },
        };
        roon.emit('now_playing', nowPlaying);
      }
    }

    async function subscribe() {
      const socket = new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`);
      sockets.push(socket);
      const messages: ServerMessage[] = [];
      socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
      await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });
      socket.send(JSON.stringify({ type: 'subscribe', zone_id: 'room' }));
      return { socket, messages };
    }

    await play('Earlier album');
    const display = await subscribe();
    await vi.waitFor(() => expect(display.messages).toContainEqual(expect.objectContaining({
      type: 'album_history', zone_id: 'room', albums: [expect.objectContaining({ album: 'Earlier album' })],
    })));
    await play('Current album');
    await play('Other room album', 'kitchen');
    await vi.waitFor(() => expect(display.messages).toContainEqual(expect.objectContaining({
      type: 'album_history', zone_id: 'room', albums: [
        expect.objectContaining({ album: 'Current album' }), expect.objectContaining({ album: 'Earlier album' }),
      ],
    })));
    expect(display.messages.some((message) => message.type === 'album_history' && message.zone_id === 'kitchen')).toBe(false);

    // Recreate the disk store, as server startup does, before a new connection subscribes.
    manager.setAlbumHistoryStore(new AlbumHistoryStore(historyFile));
    display.socket.close();
    const reconnected = await subscribe();
    await vi.waitFor(() => expect(reconnected.messages).toContainEqual(expect.objectContaining({
      type: 'album_history', albums: [
        expect.objectContaining({ album: 'Current album' }), expect.objectContaining({ album: 'Earlier album' }),
      ],
    })));
  });
});
