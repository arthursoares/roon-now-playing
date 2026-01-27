<script setup lang="ts">
import type { Track, PlaybackState } from '@roon-screen-cover/shared';

const props = defineProps<{
  track: Track | null;
  state: PlaybackState;
  isPlaying: boolean;
  progress: number;
  currentTime: string;
  duration: string;
  artworkUrl: string | null;
  zoneName: string;
}>();
</script>

<template>
  <div class="fullscreen-layout">
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
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
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
  color: #333;
}

.artwork-placeholder svg {
  width: 200px;
  height: 200px;
}

.artwork-placeholder p {
  font-size: 1.5rem;
  color: #444;
}
</style>
