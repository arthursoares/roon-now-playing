<script setup lang="ts">
import { computed } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
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
    class="fullscreen-layout"
  >
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
      <p v-if="!track">No playback</p>
    </div>
  </DynamicBackground>

  <div v-else class="fullscreen-layout" :style="backgroundStyle">
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
      <p v-if="!track">No playback</p>
    </div>
  </div>
</template>

<style scoped>
.fullscreen-layout {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color, #fff);
  transition: background 0.5s ease-out;
}

.artwork {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.artwork-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  color: var(--text-tertiary, #333);
}

.artwork-placeholder svg {
  width: 200px;
  height: 200px;
}

.artwork-placeholder p {
  font-size: 1.5rem;
  color: var(--text-tertiary, #444);
}
</style>
