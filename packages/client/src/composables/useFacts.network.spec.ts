import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick, ref, type App } from 'vue';
import type { PlaybackState, Track } from '@roon-screen-cover/shared';
import { useFacts } from './useFacts';

describe('facts request ownership', () => {
  let app: App | undefined;
  const track = ref<Track | null>(null);
  let result: ReturnType<typeof useFacts>;
  const fetchMock = vi.fn();
  const legacyKey = 'facts::artist::album::title';
  const initialTrack: Track = { artist: 'Artist', album: 'Album', title: 'Title', artwork_key: null, duration_seconds: 180 };

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    track.value = { ...initialTrack };
    fetchMock.mockReset().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url === '/api/facts/config'
        ? { rotationInterval: 25 }
        : { facts: ['Server-cached fact.'], cached: true, generatedAt: 123 },
    }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    app?.unmount();
    app = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  async function mount() {
    app = createApp(defineComponent({ setup() {
      result = useFacts(track, ref<PlaybackState>('playing'));
      return () => null;
    } }));
    app.mount(document.createElement('div'));
    await vi.advanceTimersByTimeAsync(500);
  }
  function pendingRequests() {
    fetchMock.mockImplementation((url: string) => url === '/api/facts/config'
      ? Promise.resolve({ ok: true, json: async () => ({ rotationInterval: 25 }) })
      : new Promise(() => {}));
  }
  function factsSignals(): AbortSignal[] {
    return fetchMock.mock.calls.filter(([url]) => url === '/api/facts').map(([, init]) => init.signal);
  }

  it('asks the server instead of trusting an indefinitely old browser result', async () => {
    sessionStorage.setItem(legacyKey, JSON.stringify({ facts: ['Old prompt output.'], generatedAt: 1 }));
    await mount();
    expect(fetchMock).toHaveBeenCalledWith('/api/facts', expect.anything());
    expect(result.facts.value).toEqual(['Server-cached fact.']);
    expect(result.cached.value).toBe(true);
  });

  it('does not create a second persistent result cache on the client', async () => {
    await mount();
    expect(result.facts.value).toEqual(['Server-cached fact.']);
    expect(sessionStorage.getItem(legacyKey)).toBeNull();
  });

  it('aborts the old browser request as soon as the track changes', async () => {
    pendingRequests();
    await mount();
    expect(factsSignals()[0]).toBeInstanceOf(AbortSignal);
    expect(factsSignals()[0].aborted).toBe(false);
    track.value = { ...initialTrack, title: 'Next track' };
    await nextTick();
    expect(factsSignals()[0].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(factsSignals()).toHaveLength(2);
    expect(factsSignals()[1].aborted).toBe(false);
  });

  it('aborts a pending browser request when the layout unmounts', async () => {
    pendingRequests();
    await mount();
    expect(factsSignals()[0]).toBeInstanceOf(AbortSignal);
    app!.unmount();
    app = undefined;
    expect(factsSignals()[0].aborted).toBe(true);
  });
});
