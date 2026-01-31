<script setup lang="ts">
import { computed } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import DynamicBackground from '../components/DynamicBackground.vue';
import { useColorExtraction } from '../composables/useColorExtraction';

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

const artworkUrlRef = computed(() => props.artworkUrl);
const { palette, vibrantGradient } = useColorExtraction(artworkUrlRef);

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
  <!-- Dynamic background types use DynamicBackground component -->
  <DynamicBackground
    v-if="usesDynamicBackground"
    :type="background"
    :artwork-url="artworkUrl"
    :palette="palette"
    :vibrant-gradient="vibrantGradient"
    class="minimal-layout"
  >
    <div class="overlay">
      <div v-if="track" class="track-info">
        <h1 class="title">{{ track.title }}</h1>
        <p class="artist">{{ track.artist }}</p>
      </div>
      <div v-else class="no-playback">
        <p>No playback</p>
      </div>

      <div class="progress-line">
        <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      </div>
    </div>
  </DynamicBackground>

  <!-- Original layout uses artwork as background with gradient overlay -->
  <div v-else class="minimal-layout">
    <div class="artwork-background">
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

    <div class="overlay">
      <div v-if="track" class="track-info">
        <h1 class="title">{{ track.title }}</h1>
        <p class="artist">{{ track.artist }}</p>
      </div>
      <div v-else class="no-playback">
        <p>No playback</p>
      </div>

      <div class="progress-line">
        <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.minimal-layout {
  width: 100%;
  height: 100%;
  position: relative;
  background: #000;
  color: #fff;
}

.artwork-background {
  position: absolute;
  inset: 0;
}

.artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  color: #333;
}

.artwork-placeholder svg {
  width: 30%;
  height: 30%;
  max-width: 200px;
  max-height: 200px;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.8) 0%,
    rgba(0, 0, 0, 0.4) 30%,
    transparent 60%
  );
  padding: 2rem;
}

.track-info {
  margin-bottom: 1rem;
}

.title {
  font-size: clamp(1.5rem, 5vw, 3rem);
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 0.25rem;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist {
  font-size: clamp(1rem, 3vw, 1.5rem);
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-playback {
  margin-bottom: 1rem;
}

.no-playback p {
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.6);
}

.progress-line {
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  transition: width 0.1s linear;
}
</style>
