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
          <template v-if="!currentFact || isLoading">
            <h1 v-if="track" class="title">{{ track.title }}</h1>
            <p v-if="track" class="artist">{{ track.artist }}</p>
            <p v-if="track" class="album">{{ track.album }}</p>
            <p v-if="isLoading" class="loading-hint">Loading facts...</p>
          </template>

          <template v-else>
            <p class="fact-text">{{ currentFact }}</p>
          </template>

          <p v-if="error && error.type === 'no-key'" class="error-hint">
            Configure API key in <a href="/admin">Admin</a>
          </p>

          <div v-if="!track" class="no-playback">
            <p class="no-playback-text">No playback</p>
            <p class="zone-hint">{{ zoneName }}</p>
          </div>

          <!-- Dot indicators inside card -->
          <div v-if="facts.length > 0 && currentFact" class="fact-dots">
            <span
              v-for="(_, index) in facts"
              :key="index"
              class="dot"
              :class="{ active: index === currentFactIndex }"
            />
          </div>
        </div>

        <!-- Bottom info -->
        <div class="bottom-info">
          <div class="track-meta">
            <span v-if="track" class="meta-text">
              {{ track.title }} · {{ track.artist }}
            </span>
          </div>
          <div class="time-info">
            <span>{{ currentTime }}</span>
            <span class="separator">/</span>
            <span>{{ duration }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.facts-carousel-layout {
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
  padding: clamp(24px, 4vw, 48px);
  max-width: 70%;
  min-width: 300px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: cardFadeIn 0.5s ease-out;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.title {
  font-size: clamp(24px, 4vw, 48px);
  font-weight: 600;
  line-height: 1.2;
  margin: 0 0 0.3em 0;
  color: #fff;
}

.artist {
  font-size: clamp(18px, 2.5vw, 32px);
  font-weight: 400;
  margin: 0 0 0.2em 0;
  color: rgba(255, 255, 255, 0.8);
}

.album {
  font-size: clamp(14px, 1.8vw, 24px);
  font-weight: 400;
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
}

.loading-hint {
  font-size: clamp(12px, 1.2vw, 18px);
  color: rgba(255, 255, 255, 0.5);
  margin: 1rem 0 0 0;
}

.fact-text {
  font-size: clamp(18px, 2.5vw, 32px);
  font-weight: 400;
  line-height: 1.5;
  margin: 0;
  color: #fff;
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

.error-hint {
  font-size: clamp(12px, 1.2vw, 16px);
  color: rgba(255, 255, 255, 0.5);
  margin: 1rem 0 0 0;
}

.error-hint a {
  color: rgba(255, 255, 255, 0.7);
}

.no-playback {
  color: rgba(255, 255, 255, 0.6);
}

.no-playback-text {
  font-size: clamp(20px, 2.5vw, 36px);
  margin: 0;
}

.zone-hint {
  font-size: clamp(14px, 1.5vw, 22px);
  margin: 0.5em 0 0 0;
  opacity: 0.7;
}

.bottom-info {
  position: absolute;
  bottom: 5%;
  left: 5%;
  right: 5%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: clamp(12px, 1.2vw, 16px);
}

.meta-text {
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
