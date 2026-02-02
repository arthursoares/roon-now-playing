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
        <!-- Fact card -->
        <div class="fact-card">
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

          <!-- Metadata (always visible inside card) -->
          <div v-if="track" class="metadata">
            <p class="title">{{ track.title }}</p>
            <p class="artist-album">{{ track.artist }} · {{ track.album }}</p>
          </div>
        </div>

        <!-- Bottom info (progress) -->
        <div class="bottom-info">
          <div v-if="track" class="progress-line">
            <div class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
          <div class="time-row">
            <span class="zone-name">{{ zoneName }}</span>
            <div v-if="track" class="time-info">
              <span>{{ currentTime }}</span>
              <span class="separator">/</span>
              <span>{{ duration }}</span>
            </div>
          </div>
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
.facts-carousel-layout {
  /* Fact text (main content) */
  --font-fact: clamp(22px, 3.2vw, 42px);
  --line-height-fact: 1.45;

  /* Track metadata */
  --font-title: clamp(16px, 2vw, 24px);
  --line-height-title: 1.2;
  --font-artist-album: clamp(13px, 1.5vw, 18px);
  --line-height-artist-album: 1.3;

  /* Secondary text */
  --font-loading: clamp(16px, 1.8vw, 24px);
  --font-error: clamp(14px, 1.4vw, 20px);
  --font-bottom-info: clamp(12px, 1.2vw, 16px);

  /* No playback state */
  --font-no-playback: clamp(20px, 2.5vw, 36px);
  --font-zone-hint: clamp(14px, 1.5vw, 22px);

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
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.safe-zone {
  width: 100%;
  height: 100%;
  padding: 5%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.fact-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: clamp(28px, 5vw, 56px);
  max-width: 75%;
  min-width: 300px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

/* Facts area - main content */
.facts-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 120px;
}

.fact-text {
  font-size: var(--font-fact);
  font-weight: 400;
  line-height: var(--line-height-fact);
  margin: 0;
  color: #fff;
  animation: fadeIn 0.5s ease-out;
}

.loading-hint {
  font-size: var(--font-loading);
  color: rgba(255, 255, 255, 0.5);
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
  justify-content: center;
  gap: 8px;
  margin-top: 1.5rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: background 0.3s, transform 0.3s;
}

.dot.active {
  background: #fff;
  transform: scale(1.2);
}

/* Metadata - always visible, secondary */
.metadata {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.metadata .title {
  font-size: var(--font-title);
  font-weight: 600;
  line-height: var(--line-height-title);
  margin: 0 0 0.2em 0;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata .artist-album {
  font-size: var(--font-artist-album);
  font-weight: 400;
  line-height: var(--line-height-artist-album);
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
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

/* Bottom info - fixed position */
.bottom-info {
  position: absolute;
  bottom: 5%;
  left: 5%;
  right: 5%;
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--font-bottom-info);
}

.progress-line {
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 1.5px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  transition: width 0.1s linear;
}

.time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
}

.separator {
  opacity: 0.5;
}

@media (max-width: 899px) {
  .fact-card {
    max-width: 90%;
    min-width: unset;
  }
}
</style>
