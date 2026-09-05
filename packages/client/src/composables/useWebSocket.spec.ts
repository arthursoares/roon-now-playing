import { createApp, defineComponent, h, type App, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecentAlbum } from '@roon-screen-cover/shared';
import { useWebSocket, type WebSocketState } from './useWebSocket';

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readonly readyState = MockWebSocket.OPEN;
  readonly send = vi.fn();
  readonly close = vi.fn();
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent<string>);
  }
}

describe('useWebSocket album history', () => {
  let app: App<Element> | null = null;
  let state: Ref<WebSocketState>;
  let subscribeToZone: (zoneId: string, zoneName?: string) => void;
  const onRemoteSettings = vi.fn();

  beforeEach(() => {
    MockWebSocket.instances = [];
    localStorage.clear();
    onRemoteSettings.mockClear();
    vi.stubGlobal('WebSocket', MockWebSocket);

    app = createApp(defineComponent({
      setup() {
        const socket = useWebSocket({ onRemoteSettings });
        state = socket.state;
        subscribeToZone = socket.subscribeToZone;
        return () => h('div');
      },
    }));
    app.mount(document.createElement('div'));
  });

  afterEach(() => {
    app?.unmount();
    app = null;
    vi.unstubAllGlobals();
  });

  it('keeps server order and replaces history only for the subscribed zone', () => {
    const socket = MockWebSocket.instances[0];
    const newest: RecentAlbum = {
      id: '["artist b","album b"]',
      artist: 'Artist B',
      album: 'Album B',
      artwork_key: 'b',
      last_played_at: 200,
    };
    const older: RecentAlbum = {
      id: '["artist a","album a"]',
      artist: 'Artist A',
      album: 'Album A',
      artwork_key: 'a',
      last_played_at: 100,
    };

    subscribeToZone('zone-a', 'Kitchen');
    socket.receive({ type: 'album_history', zone_id: 'zone-a', albums: [newest, older] });

    expect(state.value.albumHistory).toEqual([newest, older]);

    socket.receive({ type: 'album_history', zone_id: 'zone-b', albums: [older] });
    expect(state.value.albumHistory).toEqual([newest, older]);
  });

  it('clears playback and history on a zone switch and ignores late responses from the previous zone', () => {
    const socket = MockWebSocket.instances[0];
    const kitchenAlbum: RecentAlbum = {
      id: '["artist","kitchen album"]',
      artist: 'Artist',
      album: 'Kitchen Album',
      artwork_key: null,
      last_played_at: 100,
    };
    const officeAlbum: RecentAlbum = {
      id: '["artist","office album"]',
      artist: 'Artist',
      album: 'Office Album',
      artwork_key: null,
      last_played_at: 200,
    };

    subscribeToZone('zone-a');
    socket.receive({
      type: 'now_playing',
      zone_id: 'zone-a',
      state: 'playing',
      track: {
        title: 'Kitchen Track',
        artist: 'Artist',
        album: 'Kitchen Album',
        duration_seconds: 180,
        artwork_key: null,
      },
      seek_position: 30,
    });
    socket.receive({ type: 'album_history', zone_id: 'zone-a', albums: [kitchenAlbum] });
    subscribeToZone('zone-b');

    expect(state.value.nowPlaying).toBeNull();
    expect(state.value.albumHistory).toEqual([]);

    socket.receive({
      type: 'now_playing',
      zone_id: 'zone-a',
      state: 'playing',
      track: {
        title: 'Late Kitchen Track',
        artist: 'Artist',
        album: 'Kitchen Album',
        duration_seconds: 180,
        artwork_key: null,
      },
      seek_position: 40,
    });
    socket.receive({ type: 'album_history', zone_id: 'zone-a', albums: [kitchenAlbum] });
    expect(state.value.nowPlaying).toBeNull();
    expect(state.value.albumHistory).toEqual([]);

    socket.receive({
      type: 'now_playing',
      zone_id: 'zone-b',
      state: 'playing',
      track: {
        title: 'Office Track',
        artist: 'Artist',
        album: 'Office Album',
        duration_seconds: 180,
        artwork_key: null,
      },
      seek_position: 10,
    });
    socket.receive({ type: 'album_history', zone_id: 'zone-b', albums: [officeAlbum] });
    expect(state.value.nowPlaying?.track?.title).toBe('Office Track');
    expect(state.value.albumHistory).toEqual([officeAlbum]);
  });

  it('forwards an authoritative false interaction lock', () => {
    MockWebSocket.instances[0].receive({
      type: 'remote_settings',
      lockInteractions: false,
    });

    expect(onRemoteSettings).toHaveBeenCalledWith(expect.objectContaining({
      lockInteractions: false,
    }));
  });

  it('clears the interaction lock when the server resets the client', () => {
    localStorage.setItem('roon-screen-cover:lock-interactions', 'true');

    MockWebSocket.instances[0].receive({ type: 'client_reset' });

    expect(localStorage.getItem('roon-screen-cover:lock-interactions')).toBeNull();
  });
});
