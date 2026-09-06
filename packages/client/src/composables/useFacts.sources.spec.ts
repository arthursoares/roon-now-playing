import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick, ref, type App, type Ref } from 'vue';
import type { PlaybackState, Track } from '@roon-screen-cover/shared';
import { useFacts } from './useFacts';

describe('fact source attribution', () => {
  let app: App | undefined;
  let payload: unknown;
  let track: Ref<Track | null>;
  let playbackState: Ref<PlaybackState>;
  let result: ReturnType<typeof useFacts>;

  const firstTrack: Track = {
    title: 'First track', artist: 'Artist', album: 'Album', artwork_key: null, duration_seconds: 180,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    payload = { facts: ['Plain fact.'], cached: false, generatedAt: 1 };
    track = ref({ ...firstTrack });
    playbackState = ref('playing');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url === '/api/facts/config' ? { rotationInterval: 1 } : payload,
    })));
  });

  afterEach(() => {
    app?.unmount();
    app = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function mount(): Promise<void> {
    app = createApp(defineComponent({
      setup() {
        result = useFacts(track, playbackState);
        return () => null;
      },
    }));
    app.mount(document.createElement('div'));
    await vi.advanceTimersByTimeAsync(500);
  }

  it('keeps existing plain-fact responses free of attribution', async () => {
    payload = { facts: ['One.', 'Two.'], cached: true, generatedAt: 1 };
    await mount();

    expect(result.facts.value).toEqual(['One.', 'Two.']);
    expect(result.sources.value).toEqual([[], []]);
    expect(result.currentFactSources.value).toEqual([]);
  });

  it('preserves original source indices while removing blank facts', async () => {
    payload = {
      facts: [' First fact. ', '  ', 'Third fact.'],
      sources: [
        [{ url: 'https://musicbrainz.org/recording/first', title: ' MusicBrainz ' }],
        [{ url: 'https://example.com/wrong', title: 'Wrong source' }],
        [{ url: 'https://en.wikipedia.org/wiki/Third', title: '' }],
      ],
      cached: false,
      generatedAt: 1,
    };
    await mount();

    expect(result.facts.value).toEqual(['First fact.', 'Third fact.']);
    expect(result.sources.value).toEqual([
      [{ url: 'https://musicbrainz.org/recording/first', title: 'MusicBrainz' }],
      [{ url: 'https://en.wikipedia.org/wiki/Third', title: '' }],
    ]);
    expect(result.currentFactSources.value[0]?.title).toBe('MusicBrainz');
  });

  it('rejects malformed groups and unsafe URLs without discarding facts', async () => {
    payload = {
      facts: ['Unsafe.', 'Malformed.', 'Safe.'],
      sources: [
        [{ url: 'javascript:alert(1)', title: 'Bad' }],
        [{ url: 'https://discogs.com/release/one', title: 'Discogs' }, { url: 42, title: 'Bad' }],
        [{ url: 'https://www.allmusic.com/song/example', title: 'AllMusic' }],
      ],
      cached: false,
      generatedAt: 1,
    };
    await mount();

    expect(result.facts.value).toEqual(['Unsafe.', 'Malformed.', 'Safe.']);
    expect(result.sources.value).toEqual([
      [],
      [],
      [{ url: 'https://www.allmusic.com/song/example', title: 'AllMusic' }],
    ]);
  });

  it.each([
    'http://en.wikipedia.org/wiki/Example',
    'https://user:secret@example.com/source',
    'https://localhost/source',
    'https://127.0.0.1/source',
    'https://10.0.0.5/source',
    'https://192.168.1.5/source',
    'https://[::1]/source',
    'https://service.internal/source',
    'data:text/plain,source',
  ])('rejects non-public source URL %s', async (url) => {
    payload = {
      facts: ['Fact.'], sources: [[{ url, title: 'Unsafe' }]], cached: false, generatedAt: 1,
    };
    await mount();
    expect(result.sources.value).toEqual([[]]);
  });

  it('rotates source attribution with its fact', async () => {
    payload = {
      facts: ['One.', 'Two.'],
      sources: [
        [{ url: 'https://musicbrainz.org/one', title: 'First source' }],
        [{ url: 'https://discogs.com/two', title: 'Second source' }],
      ],
      cached: false,
      generatedAt: 1,
    };
    await mount();
    expect(result.currentFact.value).toBe('One.');
    expect(result.currentFactSources.value[0]?.title).toBe('First source');

    await vi.advanceTimersByTimeAsync(1000);
    expect(result.currentFact.value).toBe('Two.');
    expect(result.currentFactSources.value[0]?.title).toBe('Second source');
  });

  it('clears sources on a track change and never restores them from its stale response', async () => {
    type Pending = { resolve: (response: Response | PromiseLike<Response>) => void };
    const pending: Pending[] = [];
    vi.mocked(fetch).mockImplementation((url: string | URL | Request) => {
      if (url === '/api/facts/config') {
        return Promise.resolve({ ok: true, json: async () => ({ rotationInterval: 1 }) } as Response);
      }
      return new Promise((resolve) => pending.push({ resolve }));
    });
    await mount();
    expect(pending).toHaveLength(1);

    track.value = { ...firstTrack, title: 'Second track' };
    await nextTick();
    expect(result.sources.value).toEqual([]);
    await vi.advanceTimersByTimeAsync(500);
    expect(pending).toHaveLength(2);

    pending[1]!.resolve({
      ok: true,
      json: async () => ({ facts: ['New.'], sources: [[{ url: 'https://discogs.com/new', title: 'New source' }]] }),
    } as Response);
    await vi.runAllTicks();
    await nextTick();
    expect(result.currentFact.value).toBe('New.');

    pending[0]!.resolve({
      ok: true,
      json: async () => ({ facts: ['Old.'], sources: [[{ url: 'https://musicbrainz.org/old', title: 'Old source' }]] }),
    } as Response);
    await vi.runAllTicks();
    await nextTick();
    expect(result.currentFact.value).toBe('New.');
    expect(result.currentFactSources.value[0]?.title).toBe('New source');
  });

  it('clears source state when a later request errors and when unmounted', async () => {
    payload = {
      facts: ['Sourced.'], sources: [[{ url: 'https://musicbrainz.org/source', title: 'Source title' }]],
    };
    await mount();
    expect(result.sources.value).toHaveLength(1);

    payload = { error: { type: 'api-error', message: 'Unavailable' } };
    track.value = { ...firstTrack, title: 'Error track' };
    await vi.advanceTimersByTimeAsync(500);
    expect(result.sources.value).toEqual([]);

    result.sources.value = [[{ url: 'https://discogs.com/source', title: 'Temporary' }]];
    app!.unmount();
    app = undefined;
    expect(result.sources.value).toEqual([]);
  });
});
