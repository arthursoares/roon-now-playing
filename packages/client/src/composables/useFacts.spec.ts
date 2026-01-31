/**
 * Test Plan: useFacts Composable
 *
 * Scenario: Initial state
 *   Given no track is provided
 *   When the composable initializes
 *   Then facts should be empty, loading false, no error
 *
 * Scenario: Fetch facts when track changes
 *   Given a new track is set
 *   When debounce timer expires
 *   Then facts should be fetched from API
 *
 * Scenario: Debounce rapid track changes
 *   Given multiple track changes in quick succession
 *   When changes happen faster than debounce delay
 *   Then only the last track should trigger a fetch
 *
 * Scenario: Use sessionStorage cache
 *   Given facts are cached in sessionStorage
 *   When same track is requested
 *   Then cached facts should be returned without API call
 *
 * Scenario: Handle API errors
 *   Given API returns an error
 *   When fetch completes
 *   Then error state should be set with type discrimination
 *
 * Scenario: Auto-rotate facts using server-configured interval
 *   Given multiple facts are loaded and playback is 'playing'
 *   When rotation timer fires after configured interval
 *   Then currentFactIndex should advance
 *
 * Scenario: Pause rotation when not playing
 *   Given playback state is 'paused'
 *   When rotation timer would fire
 *   Then currentFactIndex should not advance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import type { Track, PlaybackState, FactsResponse, FactsError } from '@roon-screen-cover/shared';
import { useFacts } from './useFacts';

describe('useFacts', () => {
  const mockSessionStorage = new Map<string, string>();

  beforeEach(() => {
    vi.useFakeTimers();
    mockSessionStorage.clear();

    // Mock sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => mockSessionStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockSessionStorage.set(key, value),
      removeItem: (key: string) => mockSessionStorage.delete(key),
      clear: () => mockSessionStorage.clear(),
    });

    // Mock fetch - default implementation returns config with 25s rotation
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url === '/api/facts/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rotationInterval: 25 }),
        });
      }
      return Promise.reject(new Error('Unmocked URL: ' + url));
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function createMockTrack(overrides: Partial<Track> = {}): Track {
    return {
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      duration_seconds: 180,
      artwork_key: null,
      ...overrides,
    };
  }

  function mockFetchSuccess(response: FactsResponse, rotationInterval = 25): void {
    vi.mocked(fetch).mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/facts/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rotationInterval }),
        } as Response);
      }
      if (url === '/api/facts') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        } as Response);
      }
      return Promise.reject(new Error('Unmocked URL: ' + url));
    });
  }

  function mockFetchError(error: FactsError): void {
    vi.mocked(fetch).mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/facts/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rotationInterval: 25 }),
        } as Response);
      }
      if (url === '/api/facts') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error }),
        } as Response);
      }
      return Promise.reject(new Error('Unmocked URL: ' + url));
    });
  }

  describe('initial state', () => {
    it('should have empty facts initially', () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('stopped');

      const { facts } = useFacts(track, playbackState);

      expect(facts.value).toEqual([]);
    });

    it('should not be loading initially', () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('stopped');

      const { isLoading } = useFacts(track, playbackState);

      expect(isLoading.value).toBe(false);
    });

    it('should have no error initially', () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('stopped');

      const { error } = useFacts(track, playbackState);

      expect(error.value).toBeNull();
    });

    it('should have currentFact as null when no facts', () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('stopped');

      const { currentFact } = useFacts(track, playbackState);

      expect(currentFact.value).toBeNull();
    });
  });

  describe('fetching facts', () => {
    it('should fetch facts when track changes', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['Fact 1', 'Fact 2'],
        cached: false,
        generatedAt: Date.now(),
      });

      const { facts } = useFacts(track, playbackState);

      // Let config fetch complete
      await nextTick();

      // Set track
      track.value = createMockTrack();
      await nextTick();

      // Advance past debounce delay (500ms)
      await vi.advanceTimersByTimeAsync(500);

      // Should have called config endpoint + facts endpoint
      expect(fetch).toHaveBeenCalledWith('/api/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: 'Test Artist',
          album: 'Test Album',
          title: 'Test Song',
        }),
      });

      // Wait for fetch to complete
      await nextTick();

      expect(facts.value).toEqual(['Fact 1', 'Fact 2']);
    });

    it('should set loading state during fetch', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      let resolveFactsPromise: (value: Response) => void;
      vi.mocked(fetch).mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url === '/api/facts/config') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ rotationInterval: 25 }),
          } as Response);
        }
        if (url === '/api/facts') {
          return new Promise((resolve) => {
            resolveFactsPromise = resolve;
          });
        }
        return Promise.reject(new Error('Unmocked URL: ' + url));
      });

      const { isLoading } = useFacts(track, playbackState);

      // Let config fetch complete
      await nextTick();

      track.value = createMockTrack();
      await nextTick();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(500);

      expect(isLoading.value).toBe(true);

      // Resolve the facts fetch
      resolveFactsPromise!({
        ok: true,
        json: () => Promise.resolve({ facts: ['Fact 1'], cached: false, generatedAt: Date.now() }),
      } as Response);

      await nextTick();
      await nextTick();

      expect(isLoading.value).toBe(false);
    });

    it('should set cached flag from response', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['Fact 1'],
        cached: true,
        generatedAt: Date.now(),
      });

      const { cached } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(cached.value).toBe(true);
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid track changes', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      let factsCallCount = 0;
      vi.mocked(fetch).mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url === '/api/facts/config') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ rotationInterval: 25 }),
          } as Response);
        }
        if (url === '/api/facts') {
          factsCallCount++;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              facts: ['Final Fact'],
              cached: false,
              generatedAt: Date.now(),
            }),
          } as Response);
        }
        return Promise.reject(new Error('Unmocked URL: ' + url));
      });

      const { facts } = useFacts(track, playbackState);

      // Let config fetch complete
      await nextTick();

      // Rapid track changes
      track.value = createMockTrack({ title: 'Song 1' });
      await nextTick();
      await vi.advanceTimersByTimeAsync(200);

      track.value = createMockTrack({ title: 'Song 2' });
      await nextTick();
      await vi.advanceTimersByTimeAsync(200);

      track.value = createMockTrack({ title: 'Song 3' });
      await nextTick();

      // No facts fetch yet (only config was fetched)
      expect(factsCallCount).toBe(0);

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // Only one facts fetch for the last track
      expect(factsCallCount).toBe(1);
      expect(fetch).toHaveBeenLastCalledWith('/api/facts', expect.objectContaining({
        body: expect.stringContaining('Song 3'),
      }));

      expect(facts.value).toEqual(['Final Fact']);
    });

    it('should not fetch when track becomes null', async () => {
      const track = ref<Track | null>(createMockTrack());
      const playbackState = ref<PlaybackState>('playing');

      let factsCallCount = 0;
      vi.mocked(fetch).mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url === '/api/facts/config') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ rotationInterval: 25 }),
          } as Response);
        }
        if (url === '/api/facts') {
          factsCallCount++;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              facts: ['Fact 1'],
              cached: false,
              generatedAt: Date.now(),
            }),
          } as Response);
        }
        return Promise.reject(new Error('Unmocked URL: ' + url));
      });

      useFacts(track, playbackState);

      // Let config fetch complete
      await nextTick();

      // Initial facts fetch
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(factsCallCount).toBe(1);

      // Track becomes null
      track.value = null;
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);

      // No additional facts fetch
      expect(factsCallCount).toBe(1);
    });
  });

  describe('sessionStorage caching', () => {
    it('should cache facts in sessionStorage', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['Fact 1', 'Fact 2'],
        cached: false,
        generatedAt: 1234567890,
      });

      useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      const cacheKey = 'facts::test artist::test album::test song';
      const cached = mockSessionStorage.get(cacheKey);

      expect(cached).toBeDefined();
      const parsed = JSON.parse(cached!);
      expect(parsed.facts).toEqual(['Fact 1', 'Fact 2']);
    });

    it('should use cached facts from sessionStorage', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      // Pre-populate cache
      const cacheKey = 'facts::test artist::test album::test song';
      mockSessionStorage.set(cacheKey, JSON.stringify({
        facts: ['Cached Fact'],
        generatedAt: Date.now(),
      }));

      let factsCallCount = 0;
      vi.mocked(fetch).mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url === '/api/facts/config') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ rotationInterval: 25 }),
          } as Response);
        }
        if (url === '/api/facts') {
          factsCallCount++;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              facts: ['API Fact'],
              cached: false,
              generatedAt: Date.now(),
            }),
          } as Response);
        }
        return Promise.reject(new Error('Unmocked URL: ' + url));
      });

      const { facts, cached } = useFacts(track, playbackState);

      // Let config fetch complete
      await nextTick();

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // Should not call facts API (used cache)
      expect(factsCallCount).toBe(0);
      expect(facts.value).toEqual(['Cached Fact']);
      expect(cached.value).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should set error when API returns error', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchError({
        type: 'no-key',
        message: 'No API key configured',
      });

      const { error, facts } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(error.value).toEqual({
        type: 'no-key',
        message: 'No API key configured',
      });
      expect(facts.value).toEqual([]);
    });

    it('should handle network errors', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      vi.mocked(fetch).mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url === '/api/facts/config') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ rotationInterval: 25 }),
          } as Response);
        }
        if (url === '/api/facts') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.reject(new Error('Unmocked URL: ' + url));
      });

      const { error } = useFacts(track, playbackState);

      // Let config fetch complete
      await nextTick();

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(error.value).toEqual({
        type: 'api-error',
        message: 'Network error',
      });
    });

    it('should clear error on successful fetch', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      // First call fails
      mockFetchError({ type: 'api-error', message: 'Server error' });

      const { error, facts } = useFacts(track, playbackState);

      track.value = createMockTrack({ title: 'Song 1' });
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(error.value).not.toBeNull();

      // Second call succeeds
      mockFetchSuccess({
        facts: ['Fact 1'],
        cached: false,
        generatedAt: Date.now(),
      });

      track.value = createMockTrack({ title: 'Song 2' });
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(error.value).toBeNull();
      expect(facts.value).toEqual(['Fact 1']);
    });
  });

  describe('fact rotation', () => {
    it('should compute currentFact from facts and index', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['Fact 1', 'Fact 2', 'Fact 3'],
        cached: false,
        generatedAt: Date.now(),
      });

      const { currentFact, currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(currentFactIndex.value).toBe(0);
      expect(currentFact.value).toBe('Fact 1');
    });

    it('should auto-rotate facts when playing using configured interval', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      // Use custom rotation interval of 10 seconds for testing
      mockFetchSuccess({
        facts: ['Fact 1', 'Fact 2'],
        cached: false,
        generatedAt: Date.now(),
      }, 10); // 10 second rotation

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(currentFactIndex.value).toBe(0);

      // Should not rotate after 8 seconds (less than configured 10s)
      await vi.advanceTimersByTimeAsync(8000);
      await nextTick();
      expect(currentFactIndex.value).toBe(0);

      // Should rotate after reaching 10 seconds
      await vi.advanceTimersByTimeAsync(2000);
      await nextTick();
      expect(currentFactIndex.value).toBe(1);
    });

    it('should pause rotation when not playing', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['Fact 1', 'Fact 2'],
        cached: false,
        generatedAt: Date.now(),
      }, 10); // 10 second rotation

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(currentFactIndex.value).toBe(0);

      // Pause playback
      playbackState.value = 'paused';
      await nextTick();

      // Advance time well past rotation interval
      await vi.advanceTimersByTimeAsync(30000);
      await nextTick();

      // Should still be on first fact
      expect(currentFactIndex.value).toBe(0);
    });

    it('should resume rotation when playback resumes', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['Fact 1', 'Fact 2'],
        cached: false,
        generatedAt: Date.now(),
      }, 10); // 10 second rotation

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // Pause
      playbackState.value = 'paused';
      await nextTick();
      await vi.advanceTimersByTimeAsync(5000);

      // Resume
      playbackState.value = 'playing';
      await nextTick();

      // Advance past rotation time (10 seconds)
      await vi.advanceTimersByTimeAsync(10000);
      await nextTick();

      expect(currentFactIndex.value).toBe(1);
    });

    it('should wrap around to first fact after last', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['A', 'B'],
        cached: false,
        generatedAt: Date.now(),
      }, 10); // 10 second rotation

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // First rotation
      await vi.advanceTimersByTimeAsync(10000);
      await nextTick();
      expect(currentFactIndex.value).toBe(1);

      // Second rotation - should wrap
      await vi.advanceTimersByTimeAsync(10000);
      await nextTick();
      expect(currentFactIndex.value).toBe(0);
    });

    it('should use default rotation interval when config fetch fails', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      // Mock config fetch to fail, facts fetch to succeed
      vi.mocked(fetch).mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url === '/api/facts/config') {
          return Promise.reject(new Error('Network error'));
        }
        if (url === '/api/facts') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              facts: ['Fact 1', 'Fact 2'],
              cached: false,
              generatedAt: Date.now(),
            }),
          } as Response);
        }
        return Promise.reject(new Error('Unmocked URL: ' + url));
      });

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // Should use default interval of 25 seconds
      await vi.advanceTimersByTimeAsync(24000);
      await nextTick();
      expect(currentFactIndex.value).toBe(0);

      await vi.advanceTimersByTimeAsync(1000);
      await nextTick();
      expect(currentFactIndex.value).toBe(1);
    });
  });

  describe('track changes', () => {
    it('should reset facts when track changes', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['Fact for Song 1'],
        cached: false,
        generatedAt: Date.now(),
      });

      const { facts, currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack({ title: 'Song 1' });
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(facts.value).toEqual(['Fact for Song 1']);

      // Change track - facts should reset
      mockFetchSuccess({
        facts: ['Fact for Song 2'],
        cached: false,
        generatedAt: Date.now(),
      });

      track.value = createMockTrack({ title: 'Song 2' });
      await nextTick();

      // Facts cleared immediately
      expect(facts.value).toEqual([]);
      expect(currentFactIndex.value).toBe(0);

      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(facts.value).toEqual(['Fact for Song 2']);
    });
  });
});
