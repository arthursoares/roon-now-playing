<script setup lang="ts">
import { computed } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import ProgressBar from '../components/ProgressBar.vue';
import DynamicBackground from '../components/DynamicBackground.vue';
import { useColorExtraction } from '../composables/useColorExtraction';
import { useBackgroundStyle } from '../composables/useBackgroundStyle';

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

const backgroundRef = computed(() => props.background);
const artworkUrlRef = computed(() => props.artworkUrl);
const { colors, vibrantGradient, palette } = useColorExtraction(artworkUrlRef);
const { style: backgroundStyle } = useBackgroundStyle(backgroundRef, colors, vibrantGradient);

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
</script>

<template>
  <DynamicBackground
    v-if="usesDynamicBackground"
    :type="background"
    :artwork-url="artworkUrl"
    :palette="palette"
    :vibrant-gradient="vibrantGradient"
    class="detailed-layout"
  >
    <div class="artwork-container">
      <img
        v-if="artworkUrl"
        :src="artworkUrl"
        :alt="track?.album || 'Album artwork'"
        class="artwork"
      />
      <div v-else class="artwork-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
    </div>

    <div class="info-container">
      <div v-if="track" class="track-info">
        <h1 class="title">{{ track.title }}</h1>
        <p class="artist">{{ track.artist }}</p>
        <p class="album">{{ track.album }}</p>
      </div>
      <div v-else class="no-playback">
        <p>No playback</p>
        <p class="zone-hint">{{ zoneName }}</p>
      </div>

      <div v-if="track" class="progress-container">
        <ProgressBar
          :progress="progress"
          :current-time="currentTime"
          :duration="duration"
          :show-time="true"
        />
      </div>

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
  </DynamicBackground>

  <div v-else class="detailed-layout" :style="backgroundStyle">
    <div class="artwork-container">
      <img
        v-if="artworkUrl"
        :src="artworkUrl"
        :alt="track?.album || 'Album artwork'"
        class="artwork"
      />
      <div v-else class="artwork-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
    </div>

    <div class="info-container">
      <div v-if="track" class="track-info">
        <h1 class="title">{{ track.title }}</h1>
        <p class="artist">{{ track.artist }}</p>
        <p class="album">{{ track.album }}</p>
      </div>
      <div v-else class="no-playback">
        <p>No playback</p>
        <p class="zone-hint">{{ zoneName }}</p>
      </div>

      <div v-if="track" class="progress-container">
        <ProgressBar
          :progress="progress"
          :current-time="currentTime"
          :duration="duration"
          :show-time="true"
        />
      </div>

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
</template>

<style scoped>
.detailed-layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 2rem;
  gap: 2rem;
  color: var(--text-color, #fff);
  transition: background 0.5s ease-out;
}

@media (min-width: 768px) {
  .detailed-layout {
    flex-direction: row;
    padding: 3rem;
    gap: 3rem;
  }
}

.artwork-container {
  flex-shrink: 0;
  aspect-ratio: 1;
  max-height: 50vh;
  align-self: center;
}

@media (min-width: 768px) {
  .artwork-container {
    max-height: none;
    height: 100%;
    max-width: 50%;
  }
}

.artwork {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  border-radius: 8px;
  color: #444;
}

.artwork-placeholder svg {
  width: 40%;
  height: 40%;
}

.info-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.track-info {
  margin-bottom: 2rem;
}

.title {
  font-size: clamp(1.5rem, 4vw, 3rem);
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.artist {
  font-size: clamp(1rem, 2.5vw, 1.5rem);
  color: var(--text-secondary, rgba(255, 255, 255, 0.8));
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album {
  font-size: clamp(0.875rem, 2vw, 1.25rem);
  color: var(--text-tertiary, rgba(255, 255, 255, 0.5));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-playback {
  text-align: center;
}

.no-playback p {
  font-size: 1.5rem;
  color: #666;
}

.no-playback .zone-hint {
  font-size: 1rem;
  margin-top: 0.5rem;
}

.progress-container {
  margin-bottom: 2rem;
}

.zone-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.5));
  font-size: 0.875rem;
}

.zone-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playing-indicator {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}

.playing-indicator .bar {
  width: 3px;
  background: #4ade80;
  border-radius: 1px;
  animation: equalizer 0.8s ease-in-out infinite;
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
  0%, 100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}

.paused-indicator {
  font-size: 0.75rem;
}
</style>
