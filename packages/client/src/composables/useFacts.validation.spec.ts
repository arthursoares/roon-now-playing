import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, ref, type App } from 'vue';
import type { PlaybackState, Track } from '@roon-screen-cover/shared';
import { useFacts } from './useFacts';

describe('facts response validation', () => {
  let app: App;
  let result: ReturnType<typeof useFacts>;
  let payload: unknown;
  const storageKey = 'facts::artist::album::title';

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    payload = { facts: ['A complete fact.'], cached: false, generatedAt: 123 };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url === '/api/facts/config' ? { rotationInterval: 25 } : payload,
    })));
  });

  afterEach(() => {
    app?.unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function mount(advance = true) {
    app = createApp(defineComponent({
      setup() {
        const track = ref<Track>({ title: 'Title', artist: 'Artist', album: 'Album', artwork_key: null, duration_seconds: 180 });
        result = useFacts(track, ref<PlaybackState>('playing'));
        return () => null;
      },
    }));
    app.mount(document.createElement('div'));
    if (advance) await vi.advanceTimersByTimeAsync(500);
  }

  it('shows loading while a valid track waits for the debounce', async () => {
    await mount(false);
    expect(result.isLoading.value).toBe(true);
    expect(result.error.value).toBeNull();
    await vi.advanceTimersByTimeAsync(499);
    expect(result.isLoading.value).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(result.isLoading.value).toBe(false);
    expect(result.facts.value).toEqual(['A complete fact.']);
  });

  it('clears loading after the server returns cached facts', async () => {
    payload = { facts: ['Cached fact.'], cached: true, generatedAt: 123 };
    await mount();
    expect(result.isLoading.value).toBe(false);
    expect(result.facts.value).toEqual(['Cached fact.']);
    expect(result.cached.value).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/facts', expect.anything());
  });

  it('handles legacy HTTP-200 errors without assigning undefined facts or caching them', async () => {
    payload = { error: { type: 'empty', message: 'No facts generated' } };
    await mount();
    expect(result.facts.value).toEqual([]);
    expect(result.currentFact.value).toBeNull();
    expect(result.error.value).toEqual({ type: 'empty', message: 'No facts generated' });
    expect(result.isLoading.value).toBe(false);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it.each([null, {}, { facts: null }, { facts: 'not an array' }, { facts: ['valid', 3] }])(
    'rejects malformed success payload %j with a renderable error', async (value) => {
      payload = value;
      await mount();
      expect(result.facts.value).toEqual([]);
      expect(result.currentFact.value).toBeNull();
      expect(result.error.value?.type).toBe('api-error');
      expect(result.isLoading.value).toBe(false);
      expect(sessionStorage.getItem(storageKey)).toBeNull();
    },
  );

  it('treats blank-only facts as unavailable', async () => {
    payload = { facts: ['  ', '\n'], cached: false, generatedAt: 123 };
    await mount();
    expect(result.facts.value).toEqual([]);
    expect(result.error.value?.type).toBe('empty');
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('recovers from cache entries left by the old error-response bug', async () => {
    sessionStorage.setItem(storageKey, '{}');
    await mount();
    expect(result.facts.value).toEqual(['A complete fact.']);
    expect(result.error.value).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/facts', expect.anything());
    expect(result.cached.value).toBe(false);
  });
});
