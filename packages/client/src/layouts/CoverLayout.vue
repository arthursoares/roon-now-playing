<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { Track, PlaybackState } from "@roon-screen-cover/shared";

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

// Dark mode based on system preference
const prefersDark = ref(false);

// Check system preference on mount
if (typeof window !== "undefined") {
  prefersDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      prefersDark.value = e.matches;
    });
}

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
      }, 400);
    }
  },
  { immediate: true }
);

const layoutClass = computed(() => ({
  "cover-layout": true,
  "dark-mode": prefersDark.value,
}));
</script>

<template>
  <div :class="layoutClass">
    <div class="safe-zone">
      <div class="artwork-container">
        <!-- Previous artwork (for crossfade) -->
        <img
          v-if="previousArtwork && artworkTransitioning"
          :src="previousArtwork"
          alt=""
          class="artwork artwork-previous"
        />
        <!-- Current artwork -->
        <img
          v-if="displayedArtwork"
          :src="displayedArtwork"
          :alt="track?.album || 'Album artwork'"
          class="artwork"
          :class="{ 'artwork-entering': artworkTransitioning }"
        />
        <!-- Placeholder for missing artwork -->
        <div v-else class="artwork-placeholder">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cover-layout {
  width: 100%;
  height: 100%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cover-layout.dark-mode {
  background: #0a0a0a;
}

.safe-zone {
  width: 85%;
  height: 85%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.artwork-container {
  position: relative;
  /* 70%-80% of viewport height or width, whichever is smaller */
  width: min(70vh, 80vw);
  height: min(70vh, 80vw);
  aspect-ratio: 1;
}

.artwork {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 4px;
  /* Light mode shadow */
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.18);
  transition: opacity 0.4s ease-out;
}

.dark-mode .artwork {
  /* Dark mode shadow - higher opacity */
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
}

.artwork-previous {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 1;
  animation: fadeOut 0.4s ease-out forwards;
}

.artwork-entering {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Placeholder for missing artwork */
.artwork-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  /* Light mode: light gray */
  background: #f0f0f0;
  color: #ccc;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.1);
}

.dark-mode .artwork-placeholder {
  /* Dark mode: dark gray */
  background: #1a1a1a;
  color: #333;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}

.artwork-placeholder svg {
  width: 25%;
  height: 25%;
}

/* Responsive adjustments for smaller screens */
@media (max-width: 600px) {
  .artwork-container {
    width: min(70vh, 80vw);
    height: min(70vh, 80vw);
  }
}

/* Larger displays - keep artwork appropriately sized */
@media (min-width: 2000px) {
  .artwork-container {
    width: min(80vh, 80vw);
    height: min(80vh, 80vw);
  }
}
</style>
