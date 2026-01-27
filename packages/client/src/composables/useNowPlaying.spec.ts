/**
 * Test Plan: useNowPlaying Composable
 *
 * Scenario: Format time correctly
 *   Given a duration in seconds
 *   When formatted
 *   Then it should display as mm:ss
 *
 * Scenario: Calculate progress percentage
 *   Given seek position and duration
 *   When progress is computed
 *   Then it should be a percentage 0-100
 *
 * Scenario: Generate artwork URL
 *   Given an artwork key
 *   When artworkUrl is computed
 *   Then it should return the API endpoint URL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import type { NowPlaying } from '@roon-screen-cover/shared';
import { useNowPlaying } from './useNowPlaying';

describe('useNowPlaying', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null track when nowPlaying is null', () => {
    const nowPlaying = ref<NowPlaying | null>(null);
    const { track } = useNowPlaying(() => nowPlaying.value);

    expect(track.value).toBeNull();
  });

  it('should return track when nowPlaying has track', () => {
    const nowPlaying = ref<NowPlaying | null>({
      zone_id: '123',
      state: 'playing',
      track: {
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        duration_seconds: 180,
        artwork_key: 'abc123',
      },
      seek_position: 0,
    });

    const { track } = useNowPlaying(() => nowPlaying.value);

    expect(track.value).toEqual({
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      duration_seconds: 180,
      artwork_key: 'abc123',
    });
  });

  it('should compute isPlaying correctly', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'playing',
      track: null,
      seek_position: 0,
    });

    const { isPlaying } = useNowPlaying(() => nowPlaying.value);

    expect(isPlaying.value).toBe(true);

    nowPlaying.value = { ...nowPlaying.value, state: 'paused' };
    expect(isPlaying.value).toBe(false);

    nowPlaying.value = { ...nowPlaying.value, state: 'stopped' };
    expect(isPlaying.value).toBe(false);
  });

  it('should compute progress percentage', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'paused', // Paused so no interpolation
      track: {
        title: 'Test',
        artist: 'Artist',
        album: 'Album',
        duration_seconds: 100,
        artwork_key: null,
      },
      seek_position: 25,
    });

    const { progress } = useNowPlaying(() => nowPlaying.value);

    expect(progress.value).toBe(25);
  });

  it('should return 0 progress when duration is 0', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'paused',
      track: {
        title: 'Test',
        artist: 'Artist',
        album: 'Album',
        duration_seconds: 0,
        artwork_key: null,
      },
      seek_position: 50,
    });

    const { progress } = useNowPlaying(() => nowPlaying.value);

    expect(progress.value).toBe(0);
  });

  it('should format current time correctly', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'paused',
      track: {
        title: 'Test',
        artist: 'Artist',
        album: 'Album',
        duration_seconds: 300,
        artwork_key: null,
      },
      seek_position: 125, // 2:05
    });

    const { currentTimeFormatted } = useNowPlaying(() => nowPlaying.value);

    expect(currentTimeFormatted.value).toBe('2:05');
  });

  it('should format duration correctly', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'paused',
      track: {
        title: 'Test',
        artist: 'Artist',
        album: 'Album',
        duration_seconds: 245, // 4:05
        artwork_key: null,
      },
      seek_position: 0,
    });

    const { durationFormatted } = useNowPlaying(() => nowPlaying.value);

    expect(durationFormatted.value).toBe('4:05');
  });

  it('should generate artwork URL when artwork_key exists', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'paused',
      track: {
        title: 'Test',
        artist: 'Artist',
        album: 'Album',
        duration_seconds: 180,
        artwork_key: 'xyz789',
      },
      seek_position: 0,
    });

    const { artworkUrl } = useNowPlaying(() => nowPlaying.value);

    expect(artworkUrl.value).toBe('/api/artwork/xyz789');
  });

  it('should return null artworkUrl when artwork_key is null', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'paused',
      track: {
        title: 'Test',
        artist: 'Artist',
        album: 'Album',
        duration_seconds: 180,
        artwork_key: null,
      },
      seek_position: 0,
    });

    const { artworkUrl } = useNowPlaying(() => nowPlaying.value);

    expect(artworkUrl.value).toBeNull();
  });

  it('should return null artworkUrl when track is null', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'stopped',
      track: null,
      seek_position: 0,
    });

    const { artworkUrl } = useNowPlaying(() => nowPlaying.value);

    expect(artworkUrl.value).toBeNull();
  });

  it('should cap progress at 100%', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'paused',
      track: {
        title: 'Test',
        artist: 'Artist',
        album: 'Album',
        duration_seconds: 100,
        artwork_key: null,
      },
      seek_position: 150, // Over duration
    });

    const { progress } = useNowPlaying(() => nowPlaying.value);

    expect(progress.value).toBe(100);
  });

  it('should return stopped state when nowPlaying is null', () => {
    const nowPlaying = ref<NowPlaying | null>(null);
    const { state, isPlaying } = useNowPlaying(() => nowPlaying.value);

    expect(state.value).toBe('stopped');
    expect(isPlaying.value).toBe(false);
  });

  it('should return 0 duration when track is null', () => {
    const nowPlaying = ref<NowPlaying>({
      zone_id: '123',
      state: 'stopped',
      track: null,
      seek_position: 0,
    });

    const { duration, durationFormatted } = useNowPlaying(() => nowPlaying.value);

    expect(duration.value).toBe(0);
    expect(durationFormatted.value).toBe('0:00');
  });
});
