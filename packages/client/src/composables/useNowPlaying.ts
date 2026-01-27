import { ref, computed, watch, onUnmounted } from 'vue';
import type { NowPlaying } from '@roon-screen-cover/shared';

export function useNowPlaying(nowPlaying: () => NowPlaying | null) {
  const interpolatedSeek = ref(0);
  let interpolationInterval: number | null = null;

  // Track when we last synced with server
  let lastSyncTime = 0;
  let lastSyncPosition = 0;

  const track = computed(() => nowPlaying()?.track ?? null);
  const state = computed(() => nowPlaying()?.state ?? 'stopped');
  const isPlaying = computed(() => state.value === 'playing');
  const duration = computed(() => track.value?.duration_seconds ?? 0);

  const progress = computed(() => {
    if (duration.value === 0) return 0;
    return Math.min((interpolatedSeek.value / duration.value) * 100, 100);
  });

  const currentTimeFormatted = computed(() => formatTime(interpolatedSeek.value));
  const durationFormatted = computed(() => formatTime(duration.value));

  const artworkUrl = computed(() => {
    const key = track.value?.artwork_key;
    if (!key) return null;
    return `/api/artwork/${key}`;
  });

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function syncWithServer(serverPosition: number): void {
    lastSyncTime = Date.now();
    lastSyncPosition = serverPosition;
    interpolatedSeek.value = serverPosition;
  }

  function startInterpolation(): void {
    stopInterpolation();

    interpolationInterval = window.setInterval(() => {
      if (isPlaying.value && duration.value > 0) {
        // Calculate time since last sync
        const elapsed = (Date.now() - lastSyncTime) / 1000;
        const newPosition = Math.min(lastSyncPosition + elapsed, duration.value);
        interpolatedSeek.value = newPosition;
      }
    }, 100); // Update every 100ms for smooth progress
  }

  function stopInterpolation(): void {
    if (interpolationInterval) {
      clearInterval(interpolationInterval);
      interpolationInterval = null;
    }
  }

  // Watch for server seek updates
  watch(
    () => nowPlaying()?.seek_position,
    (newPosition) => {
      if (newPosition !== undefined) {
        syncWithServer(newPosition);
      }
    },
    { immediate: true }
  );

  // Watch play state to start/stop interpolation
  watch(
    isPlaying,
    (playing) => {
      if (playing) {
        startInterpolation();
      } else {
        stopInterpolation();
      }
    },
    { immediate: true }
  );

  // Watch for track changes - reset seek position
  watch(
    () => track.value?.title,
    () => {
      const serverPosition = nowPlaying()?.seek_position ?? 0;
      syncWithServer(serverPosition);
    }
  );

  onUnmounted(() => {
    stopInterpolation();
  });

  return {
    track,
    state,
    isPlaying,
    duration,
    progress,
    seekPosition: interpolatedSeek,
    currentTimeFormatted,
    durationFormatted,
    artworkUrl,
  };
}
