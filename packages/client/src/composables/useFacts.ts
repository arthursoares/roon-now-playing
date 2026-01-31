import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { Track, PlaybackState, FactsResponse, FactsError } from '@roon-screen-cover/shared';

const DEBOUNCE_DELAY = 500;
const DEFAULT_ROTATION_INTERVAL = 25; // seconds, can be overridden by server config

interface CachedFacts {
  facts: string[];
  generatedAt: number;
}

function getCacheKey(artist: string, album: string, title: string): string {
  return `facts::${artist.toLowerCase()}::${album.toLowerCase()}::${title.toLowerCase()}`;
}

function getFromSessionStorage(key: string): CachedFacts | null {
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached) as CachedFacts;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveToSessionStorage(key: string, data: CachedFacts): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

export interface UseFactsReturn {
  facts: Ref<string[]>;
  currentFactIndex: Ref<number>;
  currentFact: ComputedRef<string | null>;
  isLoading: Ref<boolean>;
  error: Ref<FactsError | null>;
  cached: Ref<boolean>;
}

export function useFacts(
  track: Ref<Track | null>,
  playbackState: Ref<PlaybackState>
): UseFactsReturn {
  const facts = ref<string[]>([]);
  const currentFactIndex = ref(0);
  const isLoading = ref(false);
  const error = ref<FactsError | null>(null);
  const cached = ref(false);
  const rotationIntervalSec = ref(DEFAULT_ROTATION_INTERVAL);

  let debounceTimer: number | null = null;
  let rotationTimer: number | null = null;

  // Fetch rotation interval from server config (immediately on composable init)
  fetch('/api/facts/config')
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
      return null;
    })
    .then((config) => {
      if (config && typeof config.rotationInterval === 'number' && config.rotationInterval > 0) {
        rotationIntervalSec.value = config.rotationInterval;
      }
    })
    .catch(() => {
      // Use default on error
    });

  const currentFact = computed(() => {
    if (facts.value.length === 0) {
      return null;
    }
    return facts.value[currentFactIndex.value] ?? null;
  });

  function clearDebounceTimer(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function clearRotationTimer(): void {
    if (rotationTimer !== null) {
      clearTimeout(rotationTimer);
      rotationTimer = null;
    }
  }

  function scheduleNextRotation(): void {
    clearRotationTimer();

    if (facts.value.length <= 1) {
      return;
    }

    if (playbackState.value !== 'playing') {
      return;
    }

    const currentFactText = facts.value[currentFactIndex.value];
    if (!currentFactText) {
      return;
    }

    // Use the configured rotation interval (in seconds, convert to ms)
    const displayTime = rotationIntervalSec.value * 1000;

    rotationTimer = window.setTimeout(() => {
      currentFactIndex.value = (currentFactIndex.value + 1) % facts.value.length;
      scheduleNextRotation();
    }, displayTime);
  }

  async function fetchFacts(trackData: Track): Promise<void> {
    const cacheKey = getCacheKey(trackData.artist, trackData.album, trackData.title);

    // Check sessionStorage cache first
    const cachedData = getFromSessionStorage(cacheKey);
    if (cachedData) {
      facts.value = cachedData.facts;
      cached.value = true;
      error.value = null;
      scheduleNextRotation();
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: trackData.artist,
          album: trackData.album,
          title: trackData.title,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        error.value = data.error as FactsError;
        facts.value = [];
        return;
      }

      const factsResponse = data as FactsResponse;
      facts.value = factsResponse.facts;
      cached.value = factsResponse.cached;
      error.value = null;

      // Cache in sessionStorage
      saveToSessionStorage(cacheKey, {
        facts: factsResponse.facts,
        generatedAt: factsResponse.generatedAt,
      });

      scheduleNextRotation();
    } catch (err) {
      error.value = {
        type: 'api-error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
      facts.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  // Watch for track changes with debouncing
  watch(
    track,
    (newTrack, oldTrack) => {
      // Clear existing timers
      clearDebounceTimer();
      clearRotationTimer();

      // Reset state when track changes
      if (newTrack?.title !== oldTrack?.title ||
          newTrack?.artist !== oldTrack?.artist ||
          newTrack?.album !== oldTrack?.album) {
        facts.value = [];
        currentFactIndex.value = 0;
        cached.value = false;
        error.value = null;
      }

      if (!newTrack) {
        return;
      }

      // Debounce the fetch
      debounceTimer = window.setTimeout(() => {
        fetchFacts(newTrack);
      }, DEBOUNCE_DELAY);
    },
    { immediate: true }
  );

  // Watch playback state for rotation control
  watch(
    playbackState,
    (state) => {
      if (state === 'playing') {
        scheduleNextRotation();
      } else {
        clearRotationTimer();
      }
    }
  );

  // Watch facts for rotation
  watch(
    facts,
    (newFacts) => {
      if (newFacts.length > 0 && playbackState.value === 'playing') {
        scheduleNextRotation();
      }
    }
  );

  onUnmounted(() => {
    clearDebounceTimer();
    clearRotationTimer();
  });

  return {
    facts,
    currentFactIndex,
    currentFact,
    isLoading,
    error,
    cached,
  };
}
