<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import { useFacts } from '../composables/useFacts';

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

const { facts, currentFactIndex, currentFact, isLoading, error } = useFacts(trackRef, stateRef);

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
  <div class="facts-overlay-layout">
    <!-- Full artwork background -->
    <div class="artwork-background">
      <img
        v-if="previousArtwork && artworkTransitioning"
        :src="previousArtwork"
        alt=""
        class="artwork artwork-previous"
      />
      <img
        v-if="displayedArtwork"
        :src="displayedArtwork"
        :alt="track?.album || 'Album artwork'"
        class="artwork"
        :class="{ 'artwork-entering': artworkTransitioning }"
      />
      <div v-else class="artwork-placeholder" />
    </div>

    <!-- Gradient overlay -->
    <div class="gradient-overlay" />

    <!-- Content overlay -->
    <div class="content-overlay">
      <div class="safe-zone">
        <!-- Facts area (main content) -->
        <div class="facts-area">
          <div v-if="!track" class="no-playback">
            <p class="no-playback-text">No playback</p>
            <p class="zone-hint">{{ zoneName }}</p>
          </div>

          <template v-else>
            <p v-if="isLoading" class="loading-hint">Loading facts...</p>
            <p v-else-if="currentFact" class="fact-text">{{ currentFact }}</p>
            <p v-else-if="error && error.type === 'no-key'" class="error-hint">
              Configure API key in <a href="/admin">Admin</a>
            </p>

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

        <!-- Metadata (always visible) -->
        <div v-if="track" class="metadata">
          <p class="title">{{ track.title }}</p>
          <p class="artist-album">{{ track.artist }} · {{ track.album }}</p>
        </div>

        <!-- Progress line -->
        <div v-if="track" class="progress-line">
          <div class="progress-fill" :style="{ width: `${progress}%` }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * ============================================
 * TYPOGRAPHY CONFIGURATION
 * Adjust these values to tweak font sizes and line heights.
 * Format: clamp(min, preferred, max)
 * ============================================
 */
.facts-overlay-layout {
  /* Fact text (main content) */
  --font-fact: clamp(26px, 4vw, 52px);
  --line-height-fact: 1.35;

  /* Track metadata */
  --font-title: clamp(18px, 2.2vw, 28px);
  --line-height-title: 1.2;
  --font-artist-album: clamp(14px, 1.6vw, 22px);
  --line-height-artist-album: 1.3;

  /* Secondary text */
  --font-loading: clamp(20px, 2.5vw, 32px);
  --font-error: clamp(16px, 1.5vw, 22px);

  /* No playback state */
  --font-no-playback: clamp(24px, 3vw, 48px);
  --font-zone-hint: clamp(16px, 2vw, 28px);

  /* Base styles */
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.artwork-background {
  position: absolute;
  inset: 0;
}

.artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.5s ease-out;
}

.artwork-previous {
  position: absolute;
  inset: 0;
  z-index: 1;
  animation: fadeOut 0.5s ease-out forwards;
}

.artwork-entering {
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

.artwork-placeholder {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
}

.gradient-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.7) 20%,
    rgba(0, 0, 0, 0.3) 40%,
    transparent 60%
  );
  pointer-events: none;
}

.content-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.safe-zone {
  padding: 5% 7.5%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
  box-sizing: border-box;
}

/* Facts area - main content */
.facts-area {
  margin-bottom: 1.5rem;
}

.fact-text {
  font-size: var(--font-fact);
  font-weight: 400;
  line-height: var(--line-height-fact);
  margin: 0;
  color: #fff;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
  max-width: 85%;
  animation: fadeIn 0.5s ease-out;
}

.loading-hint {
  font-size: var(--font-loading);
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.error-hint {
  font-size: var(--font-error);
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.error-hint a {
  color: rgba(255, 255, 255, 0.7);
}

.fact-dots {
  display: flex;
  gap: 8px;
  margin-top: 1rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  transition: background 0.3s, transform 0.3s;
}

.dot.active {
  background: #fff;
  transform: scale(1.2);
}

/* Metadata - always visible, secondary */
.metadata {
  margin-bottom: 1.5rem;
}

.metadata .title {
  font-size: var(--font-title);
  font-weight: 600;
  line-height: var(--line-height-title);
  margin: 0 0 0.2em 0;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata .artist-album {
  font-size: var(--font-artist-album);
  font-weight: 400;
  line-height: var(--line-height-artist-album);
  margin: 0;
  color: rgba(255, 255, 255, 0.75);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-playback {
  color: rgba(255, 255, 255, 0.6);
}

.no-playback-text {
  font-size: var(--font-no-playback);
  margin: 0;
}

.zone-hint {
  font-size: var(--font-zone-hint);
  margin: 0.5em 0 0 0;
  opacity: 0.7;
}

.progress-line {
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 1.5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  transition: width 0.1s linear;
}

@media (max-width: 899px) {
  .fact-text {
    max-width: 100%;
  }
}
</style>
