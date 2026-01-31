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
 * Scenario: Auto-rotate facts based on reading time
 *   Given multiple facts are loaded and playback is 'playing'
 *   When rotation timer fires
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

    // Mock fetch
    vi.stubGlobal('fetch', vi.fn());
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

  function mockFetchSuccess(response: FactsResponse): void {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
    } as Response);
  }

  function mockFetchError(error: FactsError): void {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error }),
    } as Response);
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

      const { facts, isLoading } = useFacts(track, playbackState);

      // Set track
      track.value = createMockTrack();
      await nextTick();

      // Should not fetch immediately (debounced)
      expect(fetch).not.toHaveBeenCalled();
      expect(isLoading.value).toBe(false);

      // Advance past debounce delay (500ms)
      await vi.advanceTimersByTimeAsync(500);

      expect(fetch).toHaveBeenCalledTimes(1);
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

      let resolvePromise: (value: Response) => void;
      vi.mocked(fetch).mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { isLoading } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(500);

      expect(isLoading.value).toBe(true);

      // Resolve the fetch
      resolvePromise!({
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

      mockFetchSuccess({
        facts: ['Final Fact'],
        cached: false,
        generatedAt: Date.now(),
      });

      const { facts } = useFacts(track, playbackState);

      // Rapid track changes
      track.value = createMockTrack({ title: 'Song 1' });
      await nextTick();
      await vi.advanceTimersByTimeAsync(200);

      track.value = createMockTrack({ title: 'Song 2' });
      await nextTick();
      await vi.advanceTimersByTimeAsync(200);

      track.value = createMockTrack({ title: 'Song 3' });
      await nextTick();

      // No fetch yet
      expect(fetch).not.toHaveBeenCalled();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // Only one fetch for the last track
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('/api/facts', expect.objectContaining({
        body: expect.stringContaining('Song 3'),
      }));

      expect(facts.value).toEqual(['Final Fact']);
    });

    it('should not fetch when track becomes null', async () => {
      const track = ref<Track | null>(createMockTrack());
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['Fact 1'],
        cached: false,
        generatedAt: Date.now(),
      });

      useFacts(track, playbackState);

      // Initial fetch
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(fetch).toHaveBeenCalledTimes(1);

      // Track becomes null
      track.value = null;
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);

      // No additional fetch
      expect(fetch).toHaveBeenCalledTimes(1);
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

      const { facts, cached } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // Should not call fetch
      expect(fetch).not.toHaveBeenCalled();
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

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const { error } = useFacts(track, playbackState);

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

    it('should auto-rotate facts when playing', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      // Short facts for faster rotation (8 second minimum)
      mockFetchSuccess({
        facts: ['Short fact', 'Another fact'],
        cached: false,
        generatedAt: Date.now(),
      });

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(currentFactIndex.value).toBe(0);

      // Advance by minimum rotation time (8 seconds)
      await vi.advanceTimersByTimeAsync(8000);
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
      });

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      expect(currentFactIndex.value).toBe(0);

      // Pause playback
      playbackState.value = 'paused';
      await nextTick();

      // Advance time
      await vi.advanceTimersByTimeAsync(10000);
      await nextTick();

      // Should still be on first fact
      expect(currentFactIndex.value).toBe(0);
    });

    it('should resume rotation when playback resumes', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      mockFetchSuccess({
        facts: ['Short', 'Facts'],
        cached: false,
        generatedAt: Date.now(),
      });

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

      // Advance past rotation time
      await vi.advanceTimersByTimeAsync(8000);
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
      });

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // First rotation
      await vi.advanceTimersByTimeAsync(8000);
      await nextTick();
      expect(currentFactIndex.value).toBe(1);

      // Second rotation - should wrap
      await vi.advanceTimersByTimeAsync(8000);
      await nextTick();
      expect(currentFactIndex.value).toBe(0);
    });

    it('should calculate display time based on word count', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      // Longer fact with many words (~20 words = 5 seconds + 3 padding = 8 seconds, but min is 8)
      // 40 words = 10 seconds + 3 padding = 13 seconds
      const longFact = 'This is a very long fact with many words that should take longer to read ' +
        'because it contains approximately forty words which means about ten seconds of reading time ' +
        'plus three seconds padding equals thirteen seconds total display time';

      mockFetchSuccess({
        facts: [longFact, 'Short'],
        cached: false,
        generatedAt: Date.now(),
      });

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // Should not rotate after 8 seconds (minimum)
      await vi.advanceTimersByTimeAsync(8000);
      await nextTick();
      expect(currentFactIndex.value).toBe(0);

      // Should rotate after more time (13 seconds total from start)
      await vi.advanceTimersByTimeAsync(5000);
      await nextTick();
      expect(currentFactIndex.value).toBe(1);
    });

    it('should cap display time at 30 seconds maximum', async () => {
      const track = ref<Track | null>(null);
      const playbackState = ref<PlaybackState>('playing');

      // Very long fact (200 words = 50 seconds reading time, should be capped at 30)
      const veryLongFact = Array(200).fill('word').join(' ');

      mockFetchSuccess({
        facts: [veryLongFact, 'Short'],
        cached: false,
        generatedAt: Date.now(),
      });

      const { currentFactIndex } = useFacts(track, playbackState);

      track.value = createMockTrack();
      await nextTick();
      await vi.advanceTimersByTimeAsync(500);
      await nextTick();

      // Should not rotate after 25 seconds
      await vi.advanceTimersByTimeAsync(25000);
      await nextTick();
      expect(currentFactIndex.value).toBe(0);

      // Should rotate after 30 seconds (max)
      await vi.advanceTimersByTimeAsync(5000);
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
