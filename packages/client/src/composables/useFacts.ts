import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { Track, PlaybackState, FactsError, FactSource } from '@roon-screen-cover/shared';
import { readFactSourceGroup } from '../utils/factSources';

const DEBOUNCE_DELAY = 500;
const DEFAULT_ROTATION_INTERVAL = 25; // seconds, can be overridden by server config

function readFactsAndSources(
  factsValue: unknown,
  sourcesValue: unknown,
): { facts: string[]; sources: FactSource[][] } | null {
  if (!Array.isArray(factsValue)
    || !factsValue.every((item): item is string => typeof item === 'string')) return null;

  const hasAlignedSources = Array.isArray(sourcesValue) && sourcesValue.length === factsValue.length;
  const facts: string[] = [];
  const sources: FactSource[][] = [];
  factsValue.forEach((fact, originalIndex) => {
    const trimmed = fact.trim();
    if (!trimmed) return;
    facts.push(trimmed);
    sources.push(hasAlignedSources ? readFactSourceGroup(sourcesValue[originalIndex]) : []);
  });
  return { facts, sources };
}

function readError(value: unknown): FactsError {
  if (typeof value === 'string' && value.trim()) return { type: 'api-error', message: value };
  if (value && typeof value === 'object') {
    const error = value as Partial<FactsError>;
    return {
      type: error.type === 'no-key' || error.type === 'empty' ? error.type : 'api-error',
      message: typeof error.message === 'string' && error.message.trim()
        ? error.message : 'Facts are unavailable right now. Please try again.',
    };
  }
  return { type: 'api-error', message: 'Facts are unavailable right now. Please try again.' };
}

export interface UseFactsReturn {
  facts: Ref<string[]>;
  sources: Ref<FactSource[][]>;
  currentFactIndex: Ref<number>;
  currentFact: ComputedRef<string | null>;
  currentFactSources: ComputedRef<FactSource[]>;
  isLoading: Ref<boolean>;
  error: Ref<FactsError | null>;
  cached: Ref<boolean>;
}

export function useFacts(
  track: Ref<Track | null>,
  playbackState: Ref<PlaybackState>
): UseFactsReturn {
  const facts = ref<string[]>([]);
  const sources = ref<FactSource[][]>([]);
  const currentFactIndex = ref(0);
  const isLoading = ref(false);
  const error = ref<FactsError | null>(null);
  const cached = ref(false);
  const rotationIntervalSec = ref(DEFAULT_ROTATION_INTERVAL);

  let debounceTimer: number | null = null;
  let rotationTimer: number | null = null;
  let requestGeneration = 0;
  let active = true;
  let activeRequest: AbortController | null = null;

  // Fetch rotation interval from server config (immediately on composable init)
  fetch('/api/facts/config')
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
      return null;
    })
    .then((config) => {
      if (active && config && typeof config.rotationInterval === 'number' && config.rotationInterval > 0) {
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
  const currentFactSources = computed(() => sources.value[currentFactIndex.value] ?? []);

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
      rotationTimer = null;
      if (!active) return;
      currentFactIndex.value = (currentFactIndex.value + 1) % facts.value.length;
      scheduleNextRotation();
    }, displayTime);
  }

  async function fetchFacts(trackData: Track, generation: number): Promise<void> {
    isLoading.value = true;
    error.value = null;

    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    activeRequest = controller;
    try {
      const response = await fetch('/api/facts', {
        signal: controller?.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: trackData.artist,
          album: trackData.album,
          title: trackData.title,
        }),
      });

      const body: unknown = await response.json();
      const data = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};

      if (!active || generation !== requestGeneration) return;

      if (!response.ok || data.error) {
        error.value = readError(data.error);
        facts.value = [];
        sources.value = [];
        cached.value = false;
        return;
      }

      const parsed = readFactsAndSources(data.facts, data.sources);
      if (!parsed?.facts.length) {
        facts.value = [];
        sources.value = [];
        cached.value = false;
        error.value = parsed
          ? { type: 'empty', message: 'No usable facts could be generated. Please try again.' }
          : { type: 'api-error', message: 'The facts service returned an invalid response. Please try again.' };
        return;
      }
      facts.value = parsed.facts;
      sources.value = parsed.sources;
      cached.value = data.cached === true;
      error.value = null;
    } catch (err) {
      if (!active || generation !== requestGeneration) return;
      error.value = {
        type: 'api-error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
      facts.value = [];
      sources.value = [];
    } finally {
      if (activeRequest === controller) activeRequest = null;
      if (active && generation === requestGeneration) {
        isLoading.value = false;
        // Schedule rotation AFTER loading is complete, so first fact gets full display time
        if (facts.value.length > 1 && playbackState.value === 'playing') {
          scheduleNextRotation();
        }
      }
    }
  }

  // Watch for track changes with debouncing
  watch(
    track,
    (newTrack, oldTrack) => {
      // Check if track actually changed (not just object reference)
      const trackActuallyChanged =
        newTrack?.title !== oldTrack?.title ||
        newTrack?.artist !== oldTrack?.artist ||
        newTrack?.album !== oldTrack?.album;

      // If track data is the same (just a ref update from zone events), ignore
      if (!trackActuallyChanged && newTrack && oldTrack) {
        return;
      }

      const generation = ++requestGeneration;
      activeRequest?.abort();
      activeRequest = null;

      // Clear existing timers only when track actually changes
      clearDebounceTimer();
      clearRotationTimer();

      // Reset state when track changes
      if (trackActuallyChanged) {
        facts.value = [];
        sources.value = [];
        currentFactIndex.value = 0;
        cached.value = false;
        error.value = null;
        isLoading.value = false;
      }

      if (!newTrack) {
        return;
      }

      isLoading.value = true;

      // Debounce the fetch
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        if (!active || generation !== requestGeneration) return;
        fetchFacts(newTrack, generation);
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

  // Note: We don't watch `facts` directly for rotation scheduling.
  // Rotation is scheduled explicitly after facts load (in fetchFacts)
  // to ensure the first fact gets its full display time.

  onUnmounted(() => {
    active = false;
    requestGeneration++;
    activeRequest?.abort();
    activeRequest = null;
    clearDebounceTimer();
    clearRotationTimer();
    isLoading.value = false;
    facts.value = [];
    sources.value = [];
  });

  return {
    facts,
    sources,
    currentFactIndex,
    currentFact,
    currentFactSources,
    isLoading,
    error,
    cached,
  };
}
