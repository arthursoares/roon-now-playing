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
        <!-- Track info or fact -->
        <div class="text-content">
          <template v-if="!currentFact || isLoading">
            <h1 v-if="track" class="title">{{ track.title }}</h1>
            <p v-if="track" class="artist">{{ track.artist }}</p>
            <p v-if="isLoading" class="loading-hint">Loading facts...</p>
          </template>

          <template v-else>
            <p class="fact-text">{{ currentFact }}</p>
            <div class="fact-dots">
              <span
                v-for="(_, index) in facts"
                :key="index"
                class="dot"
                :class="{ active: index === currentFactIndex }"
              />
            </div>
          </template>

          <p v-if="error && error.type === 'no-key'" class="error-hint">
            Configure API key in <a href="/admin">Admin</a>
          </p>

          <div v-if="!track" class="no-playback">
            <p class="no-playback-text">No playback</p>
            <p class="zone-hint">{{ zoneName }}</p>
          </div>
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
.facts-overlay-layout {
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
}

.text-content {
  margin-bottom: 1.5rem;
}

.title {
  font-size: clamp(32px, 5vw, 64px);
  font-weight: 600;
  line-height: 1.1;
  margin: 0 0 0.3em 0;
  color: #fff;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.artist {
  font-size: clamp(20px, 3vw, 40px);
  font-weight: 400;
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.loading-hint {
  font-size: clamp(14px, 1.5vw, 20px);
  color: rgba(255, 255, 255, 0.6);
  margin: 1rem 0 0 0;
}

.fact-text {
  font-size: clamp(20px, 3vw, 36px);
  font-weight: 400;
  line-height: 1.4;
  margin: 0;
  color: #fff;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
  max-width: 80%;
  animation: fadeIn 0.5s ease-out;
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
  font-size: clamp(24px, 3vw, 48px);
  margin: 0;
}

.zone-hint {
  font-size: clamp(16px, 2vw, 28px);
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
