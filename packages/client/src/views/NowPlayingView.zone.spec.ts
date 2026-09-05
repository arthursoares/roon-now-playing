import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, ref, type App } from 'vue';
import NowPlayingView from './NowPlayingView.vue';

const socketMock = vi.hoisted(() => ({
  onRemoteSettings: undefined as ((settings: {
    zoneId?: string;
    zoneName?: string;
  }) => void) | undefined,
  subscribeToZone: vi.fn(),
}));

const wsState = ref({
  connected: false,
  roonConnected: false,
  roonEnabled: false,
  friendlyName: null,
  zones: [] as Array<{ id: string; display_name: string }>,
  nowPlaying: null,
  albumHistory: [],
  clients: [],
  displaySettings: { fontScale: 1, artworkScale: 100 },
});

vi.mock('../composables/useWebSocket', () => ({
  useWebSocket: (options: { onRemoteSettings?: typeof socketMock.onRemoteSettings }) => {
    socketMock.onRemoteSettings = options.onRemoteSettings;
    return {
      state: wsState,
      subscribeToZone: socketMock.subscribeToZone,
      updateMetadata: vi.fn(),
    };
  },
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test') },
}));

describe('NowPlayingView URL zone priority', () => {
  let app: App<Element> | null = null;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('roon-screen-cover:zone', 'Stored room');
    window.history.replaceState({}, '', '/?zone=url-zone');
    socketMock.subscribeToZone.mockReset();
    socketMock.onRemoteSettings = undefined;
    wsState.value = {
      connected: false,
      roonConnected: false,
      roonEnabled: false,
      friendlyName: null,
      zones: [],
      nowPlaying: null,
      albumHistory: [],
      clients: [],
      displaySettings: { fontScale: 1, artworkScale: 100 },
    };
  });

  afterEach(() => {
    app?.unmount();
    app = null;
    window.history.replaceState({}, '', '/');
  });

  it('keeps a valid URL zone when stored remote settings replay after zones load', async () => {
    app = createApp(NowPlayingView);
    app.mount(document.createElement('div'));

    wsState.value.connected = true;
    wsState.value.zones = [
      { id: 'stored-zone', display_name: 'Stored room' },
      { id: 'url-zone', display_name: 'URL room' },
    ];
    await nextTick();

    expect(socketMock.subscribeToZone).toHaveBeenLastCalledWith('url-zone', 'URL room');
    socketMock.subscribeToZone.mockClear();

    socketMock.onRemoteSettings?.({ zoneId: 'stored-zone', zoneName: 'Stored room' });

    expect(socketMock.subscribeToZone).toHaveBeenCalledTimes(1);
    expect(socketMock.subscribeToZone).toHaveBeenLastCalledWith('url-zone', 'URL room');
  });
});
