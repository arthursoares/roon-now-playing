<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import { useColorExtraction } from '../composables/useColorExtraction';
import { useBackgroundStyle } from '../composables/useBackgroundStyle';
import { useFacts } from '../composables/useFacts';
import ProgressBar from '../components/ProgressBar.vue';
import DynamicBackground from '../components/DynamicBackground.vue';

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
const backgroundRef = computed(() => props.background);
const artworkUrlRef = computed(() => props.artworkUrl);

const { colors, vibrantGradient, palette } = useColorExtraction(artworkUrlRef);
const { style: backgroundStyle } = useBackgroundStyle(backgroundRef, colors, vibrantGradient);
const { facts, currentFactIndex, currentFact, isLoading, error } = useFacts(trackRef, stateRef);

// Background types handled by DynamicBackground component
const dynamicBackgroundTypes: BackgroundType[] = [
  'gradient-linear-multi',
  'gradient-radial-corner',
  'gradient-mesh',
  'blur-subtle',
  'blur-heavy',
  'duotone',
  'posterized',
  'gradient-noise',
  'blur-grain',
];

const usesDynamicBackground = computed(() =>
  dynamicBackgroundTypes.includes(props.background)
);

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
  <DynamicBackground
    v-if="usesDynamicBackground"
    :type="background"
    :artwork-url="artworkUrl"
    :palette="palette"
    :vibrant-gradient="vibrantGradient"
    class="facts-columns-layout"
  >
    <div class="safe-zone">
      <div class="content">
        <!-- Left column: Artwork -->
        <div class="artwork-column">
          <div class="artwork-wrapper">
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
            <div v-else class="artwork-placeholder">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- Right column: Facts -->
        <div class="facts-column">
          <!-- Loading / Track Info State -->
          <div v-if="!currentFact || isLoading" class="track-info">
            <h1 v-if="track" class="title">{{ track.title }}</h1>
            <p v-if="track" class="artist">{{ track.artist }}</p>
            <p v-if="track" class="album">{{ track.album }}</p>
            <p v-if="isLoading" class="loading-hint">Loading facts...</p>
            <div v-if="!track" class="no-playback">
              <p class="no-playback-text">No playback</p>
              <p class="zone-hint">{{ zoneName }}</p>
            </div>
          </div>

          <!-- Facts Display -->
          <div v-else class="facts-display">
            <p class="fact-text">{{ currentFact }}</p>

            <!-- Dot indicators -->
            <div class="fact-dots">
              <span
                v-for="(_, index) in facts"
                :key="index"
                class="dot"
                :class="{ active: index === currentFactIndex }"
              />
            </div>
          </div>

          <!-- Error State -->
          <div v-if="error && !isLoading" class="error-state">
            <p v-if="error.type === 'no-key'" class="error-message">
              Configure API key in <a href="/admin">Admin Panel</a>
            </p>
            <p v-else class="error-message">{{ error.message }}</p>
          </div>

          <!-- Progress bar -->
          <div v-if="track" class="progress-container">
            <ProgressBar
              :progress="progress"
              :current-time="currentTime"
              :duration="duration"
              :show-time="true"
            />
          </div>

          <!-- Zone indicator -->
          <div class="zone-indicator">
            <span class="zone-name">{{ zoneName }}</span>
            <span v-if="isPlaying" class="playing-indicator">
              <span class="bar"></span>
              <span class="bar"></span>
              <span class="bar"></span>
            </span>
            <span v-else-if="state === 'paused'" class="paused-indicator">⏸</span>
          </div>
        </div>
      </div>
    </div>
  </DynamicBackground>

  <div v-else class="facts-columns-layout" :style="backgroundStyle">
    <div class="safe-zone">
      <div class="content">
        <!-- Left column: Artwork -->
        <div class="artwork-column">
          <div class="artwork-wrapper">
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
            <div v-else class="artwork-placeholder">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- Right column: Facts -->
        <div class="facts-column">
          <!-- Loading / Track Info State -->
          <div v-if="!currentFact || isLoading" class="track-info">
            <h1 v-if="track" class="title">{{ track.title }}</h1>
            <p v-if="track" class="artist">{{ track.artist }}</p>
            <p v-if="track" class="album">{{ track.album }}</p>
            <p v-if="isLoading" class="loading-hint">Loading facts...</p>
            <div v-if="!track" class="no-playback">
              <p class="no-playback-text">No playback</p>
              <p class="zone-hint">{{ zoneName }}</p>
            </div>
          </div>

          <!-- Facts Display -->
          <div v-else class="facts-display">
            <p class="fact-text">{{ currentFact }}</p>

            <!-- Dot indicators -->
            <div class="fact-dots">
              <span
                v-for="(_, index) in facts"
                :key="index"
                class="dot"
                :class="{ active: index === currentFactIndex }"
              />
            </div>
          </div>

          <!-- Error State -->
          <div v-if="error && !isLoading" class="error-state">
            <p v-if="error.type === 'no-key'" class="error-message">
              Configure API key in <a href="/admin">Admin Panel</a>
            </p>
            <p v-else class="error-message">{{ error.message }}</p>
          </div>

          <!-- Progress bar -->
          <div v-if="track" class="progress-container">
            <ProgressBar
              :progress="progress"
              :current-time="currentTime"
              :duration="duration"
              :show-time="true"
            />
          </div>

          <!-- Zone indicator -->
          <div class="zone-indicator">
            <span class="zone-name">{{ zoneName }}</span>
            <span v-if="isPlaying" class="playing-indicator">
              <span class="bar"></span>
              <span class="bar"></span>
              <span class="bar"></span>
            </span>
            <span v-else-if="state === 'paused'" class="paused-indicator">⏸</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.facts-columns-layout {
  width: 100%;
  height: 100%;
  color: var(--text-color, #fff);
  transition: background 0.5s ease-out;
  overflow: hidden;
}

.safe-zone {
  width: 100%;
  height: 100%;
  padding: 5%;
  box-sizing: border-box;
}

.content {
  width: 100%;
  height: 100%;
  padding: 2.5%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (min-width: 900px) {
  .content {
    flex-direction: row;
    align-items: center;
    gap: 5%;
  }
}

.artwork-column {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 45vh;
}

@media (min-width: 900px) {
  .artwork-column {
    width: 55%;
    max-width: none;
    flex: 0 0 55%;
  }
}

.artwork-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  color: var(--text-tertiary);
}

.artwork-placeholder svg {
  width: 30%;
  height: 30%;
  opacity: 0.5;
}

.facts-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding-right: 2.5%;
}

@media (min-width: 900px) {
  .facts-column {
    flex: 0 0 40%;
  }
}

.track-info,
.facts-display {
  margin-bottom: 2rem;
}

.title {
  font-size: clamp(28px, 4.5vw, 56px);
  font-weight: 600;
  line-height: 1.15;
  margin: 0 0 0.4em 0;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.artist {
  font-size: clamp(20px, 3vw, 40px);
  font-weight: 400;
  line-height: 1.2;
  margin: 0 0 0.2em 0;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album {
  font-size: clamp(16px, 2vw, 28px);
  font-weight: 400;
  line-height: 1.3;
  margin: 0;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-hint {
  font-size: clamp(14px, 1.5vw, 20px);
  color: var(--text-tertiary);
  margin-top: 1rem;
}

.fact-text {
  font-size: clamp(18px, 2.5vw, 32px);
  font-weight: 400;
  line-height: 1.5;
  margin: 0;
  color: var(--text-color);
  animation: fadeIn 0.5s ease-out;
}

.fact-dots {
  display: flex;
  gap: 8px;
  margin-top: 1.5rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: background 0.3s, transform 0.3s;
}

.dot.active {
  background: var(--text-color);
  transform: scale(1.2);
}

.error-state {
  margin-bottom: 2rem;
}

.error-message {
  font-size: clamp(14px, 1.5vw, 18px);
  color: var(--text-tertiary);
  margin: 0;
}

.error-message a {
  color: var(--text-secondary);
  text-decoration: underline;
}

.progress-container {
  margin-bottom: 2rem;
}

.zone-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-tertiary);
  font-size: clamp(14px, 1.5vw, 20px);
}

.zone-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playing-indicator {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 18px;
}

.playing-indicator .bar {
  width: 4px;
  background: currentColor;
  border-radius: 2px;
  animation: equalizer 0.8s ease-in-out infinite;
  opacity: 0.8;
}

.playing-indicator .bar:nth-child(1) {
  height: 40%;
  animation-delay: 0s;
}

.playing-indicator .bar:nth-child(2) {
  height: 100%;
  animation-delay: 0.2s;
}

.playing-indicator .bar:nth-child(3) {
  height: 60%;
  animation-delay: 0.4s;
}

@keyframes equalizer {
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}

.paused-indicator {
  font-size: 1em;
  opacity: 0.8;
}

.no-playback {
  text-align: left;
}

.no-playback-text {
  font-size: clamp(24px, 3vw, 48px);
  color: var(--text-tertiary);
  margin: 0;
}

.zone-hint {
  font-size: clamp(16px, 2vw, 28px);
  color: var(--text-tertiary);
  margin: 0.5em 0 0 0;
  opacity: 0.7;
}

@media (max-width: 899px) {
  .content {
    justify-content: center;
  }

  .facts-column {
    text-align: center;
    padding-right: 0;
  }

  .fact-dots {
    justify-content: center;
  }

  .zone-indicator {
    justify-content: center;
  }

  .no-playback {
    text-align: center;
  }
}
</style>
