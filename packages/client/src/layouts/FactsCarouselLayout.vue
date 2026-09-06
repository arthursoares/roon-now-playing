<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import { useFacts } from '../composables/useFacts';
import FactSources from '../components/FactSources.vue';
import { getProgressTransform } from '../utils/progress';

const props = defineProps<{
  track: Track | null;
  state: PlaybackState;
  isPlaying: boolean;
  progress: number;
  currentTime: string;
  duration: string;
  artworkUrl: string | null;
  zoneName: string;
  background: BackgroundType;
}>();

const trackRef = computed(() => props.track);
const stateRef = computed(() => props.state);

const { facts, currentFactIndex, currentFact, currentFactSources, isLoading, error } = useFacts(trackRef, stateRef);

// Track previous artwork for crossfade
const displayedArtwork = ref<string | null>(null);
const previousArtwork = ref<string | null>(null);
const artworkTransitioning = ref(false);

watch(
  () => props.artworkUrl,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      previousArtwork.value = displayedArtwork.value;
      displayedArtwork.value = newUrl;
      artworkTransitioning.value = true;
      setTimeout(() => {
        artworkTransitioning.value = false;
        previousArtwork.value = null;
      }, 500);
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="facts-carousel-layout">
    <!-- Blurred artwork background -->
    <div class="artwork-background">
      <img
        v-if="previousArtwork && artworkTransitioning"
        :src="previousArtwork"
        alt=""
        class="bg-artwork bg-artwork-previous"
      />
      <img
        v-if="displayedArtwork"
        :src="displayedArtwork"
        alt=""
        class="bg-artwork"
        :class="{ 'bg-artwork-entering': artworkTransitioning }"
      />
      <div v-else class="bg-placeholder" />
    </div>

    <!-- Dark overlay -->
    <div class="dark-overlay" />

    <!-- Content -->
    <div class="content">
      <div class="safe-zone">
        <!-- Fact (hero) — big type, no card -->
        <div class="facts-area">
          <div v-if="!track" class="no-playback">
            <p class="no-playback-text">No playback</p>
            <p class="zone-hint">{{ zoneName }}</p>
          </div>

          <template v-else>
            <p v-if="isLoading" class="loading-hint">Loading facts…</p>
            <template v-else-if="currentFact">
              <p class="fact-text">{{ currentFact }}</p>
              <FactSources :sources="currentFactSources" />
            </template>
            <p v-else-if="error && error.type === 'no-key'" class="error-hint">
              Configure API key in <a href="/admin">Admin</a>
            </p>
            <p v-else-if="error" class="error-hint" role="status">{{ error.message }}</p>
            <p v-else class="error-hint" role="status">Facts are unavailable for this track.</p>

            <!-- Dot indicators -->
            <div v-if="facts.length > 1" class="fact-dots">
              <span
                v-for="(_, index) in facts"
                :key="index"
                class="dot"
                :class="{ active: index === currentFactIndex }"
              />
            </div>
          </template>
        </div>

        <!-- Now-playing chip (bottom) -->
        <div v-if="track" class="now-playing">
          <div class="np-line">
            <span class="np-title">{{ track.title }}</span>
            <span class="np-sep">·</span>
            <span class="np-artist">{{ track.artist }}</span>
          </div>
          <div class="progress-line">
            <div class="progress-fill" :style="{ transform: getProgressTransform(progress) }" />
          </div>
          <div class="np-meta">
            <span class="zone-name">{{ zoneName }}</span>
            <span class="time-info">{{ currentTime }} / {{ duration }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * ============================================
 * TYPOGRAPHY
 * Uses token-based container queries for responsive scaling.
 * See: packages/client/src/styles/tokens.css
 * ============================================
 */
.facts-carousel-layout {
  container-type: inline-size;
  container-name: layout;

  /* Base styles */
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.artwork-background {
  position: absolute;
  inset: -20px; /* Extend beyond edges for blur */
}

.bg-artwork {
  width: calc(100% + 40px);
  height: calc(100% + 40px);
  object-fit: cover;
  filter: blur(30px) brightness(0.6);
  transform: scale(1.1);
  transition: opacity 0.5s ease-out;
}

.bg-artwork-previous {
  position: absolute;
  inset: 0;
  z-index: 1;
  animation: fadeOut 0.5s ease-out forwards;
}

.bg-artwork-entering {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.bg-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.dark-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
}

.content {
  position: relative;
  width: 100%;
  height: 100%;
}

.safe-zone {
  width: 100%;
  height: 100%;
  padding: 6% 8%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* Fact (hero) — big type directly on the background, no card */
.facts-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.fact-text {
  font-size: calc(var(--fluid-fact) * var(--font-scale, 1));
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  margin: 0;
  max-width: 18em;
  color: #fff;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.55);
  animation: fadeIn 0.5s ease-out;
}

.loading-hint,
.error-hint {
  font-size: calc(var(--fluid-caption) * var(--font-scale, 1));
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.error-hint a {
  color: #fff;
}

.fact-dots {
  display: flex;
  justify-content: center;
  gap: clamp(10px, 1cqi, 22px);
  margin-top: clamp(1.5rem, 3cqi, 3.5rem);
}

.dot {
  width: clamp(8px, 0.9cqi, 20px);
  height: clamp(8px, 0.9cqi, 20px);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  transition: background 0.3s, transform 0.3s;
}

.dot.active {
  background: #fff;
  transform: scale(1.25);
}

.no-playback {
  color: rgba(255, 255, 255, 0.75);
}

.no-playback-text {
  font-size: calc(var(--fluid-hero) * var(--font-scale, 1));
  font-weight: var(--font-semibold);
  margin: 0;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.55);
}

.zone-hint {
  font-size: calc(var(--fluid-caption) * var(--font-scale, 1));
  margin: 0.6em 0 0 0;
  opacity: 0.75;
}

/* Now-playing chip (bottom) */
.now-playing {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.5);
}

.np-line {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 0.4em;
  font-size: calc(var(--fluid-subtitle) * var(--font-scale, 1));
  white-space: nowrap;
  overflow: hidden;
}

.np-title {
  font-weight: var(--font-semibold);
  color: #fff;
}

.np-sep {
  opacity: 0.5;
}

.np-artist {
  color: rgba(255, 255, 255, 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-line {
  height: clamp(3px, 0.35cqi, 8px);
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.92);
  transform-origin: left center;
  transition: transform 0.1s linear;
  will-change: transform;
}

.np-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: calc(var(--fluid-caption) * var(--font-scale, 1));
  color: rgba(255, 255, 255, 0.7);
}

.zone-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.time-info {
  display: flex;
  gap: 0.3em;
  font-variant-numeric: tabular-nums;
}
</style>
