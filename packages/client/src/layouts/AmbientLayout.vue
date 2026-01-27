<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Track, PlaybackState } from '@roon-screen-cover/shared';
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
}>();

const artworkUrlRef = computed(() => props.artworkUrl);
const { colors, isTransitioning } = useColorExtraction(artworkUrlRef);

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

const backgroundStyle = computed(() => ({
  '--bg-color': colors.value.background,
  '--bg-edge': colors.value.backgroundEdge,
  '--shadow-color': colors.value.shadow,
  '--text-color': colors.value.text,
  '--text-secondary': colors.value.textSecondary,
  '--text-tertiary': colors.value.textTertiary,
}));

const progressStyle = computed(() => ({
  width: `${props.progress}%`,
}));
</script>

<template>
  <div
    class="ambient-layout"
    :class="{ transitioning: isTransitioning }"
    :style="backgroundStyle"
  >
    <div class="safe-zone">
      <div class="content">
        <!-- Left column: Artwork -->
        <div class="artwork-column">
          <div class="artwork-wrapper">
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
            <div v-else class="artwork-placeholder">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          </div>

          <!-- Progress bar below artwork -->
          <div v-if="track" class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="progressStyle"></div>
            </div>
            <div class="progress-times">
              <span>{{ currentTime }}</span>
              <span>{{ duration }}</span>
            </div>
          </div>
        </div>

        <!-- Right column: Metadata -->
        <div class="metadata-column">
          <div v-if="track" class="track-info">
            <h1 class="artist">{{ track.artist }}</h1>
            <h2 class="title">{{ track.title }}</h2>
            <p class="album">{{ track.album }}</p>
          </div>
          <div v-else class="no-playback">
            <p class="no-playback-text">No playback</p>
            <p class="zone-name">{{ zoneName }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ambient-layout {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(
      ellipse 120% 100% at 30% 50%,
      var(--bg-color) 0%,
      var(--bg-edge) 100%
    );
  color: var(--text-color);
  transition: background 0.5s ease-out;
  overflow: hidden;
}

.ambient-layout.transitioning {
  transition: background 0.5s ease-out;
}

.safe-zone {
  width: 100%;
  height: 100%;
  padding: 5%; /* Overscan safe */
  box-sizing: border-box;
}

.content {
  width: 100%;
  height: 100%;
  padding: 2.5%; /* Content safe = 7.5% total */
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

/* Artwork Column */
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
  box-shadow:
    0 8px 30px var(--shadow-color),
    0 4px 15px var(--shadow-color);
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
  opacity: 1;
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
  background: var(--bg-edge);
  color: var(--text-tertiary);
}

.artwork-placeholder svg {
  width: 30%;
  height: 30%;
  opacity: 0.5;
}

/* Progress Bar */
.progress-container {
  width: 100%;
  margin-top: 1.5rem;
  padding: 0 2%;
}

.progress-bar {
  height: 6px;
  background: var(--text-tertiary);
  border-radius: 3px;
  overflow: hidden;
  opacity: 0.4;
}

.progress-fill {
  height: 100%;
  background: var(--text-color);
  border-radius: 3px;
  transition: width 0.2s linear;
  opacity: 0.8;
}

.progress-times {
  display: flex;
  justify-content: space-between;
  margin-top: 0.75rem;
  font-size: clamp(14px, 1.5vw, 20px);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

/* Metadata Column */
.metadata-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding-right: 2.5%; /* Extra text safe margin */
}

@media (min-width: 900px) {
  .metadata-column {
    flex: 0 0 40%;
  }
}

.track-info {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}

/* Typography - 10ft UI Scale */
.artist {
  font-size: clamp(32px, 5vw, 64px);
  font-weight: 700;
  line-height: 1.1;
  margin: 0;
  color: var(--text-color);

  /* Single line with ellipsis */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 90%;
}

.title {
  font-size: clamp(24px, 3.5vw, 48px);
  font-weight: 400;
  line-height: 1.2;
  margin: 0;
  margin-top: 0.1em;
  color: var(--text-secondary);

  /* Two lines with ellipsis */
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  max-width: 90%;
}

.album {
  font-size: clamp(18px, 2.5vw, 36px);
  font-weight: 400;
  line-height: 1.3;
  margin: 0;
  margin-top: 1em; /* Larger gap before secondary info */
  color: var(--text-tertiary);

  /* Single line with ellipsis */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 85%;
}

/* No playback state */
.no-playback {
  text-align: left;
}

.no-playback-text {
  font-size: clamp(24px, 3vw, 48px);
  color: var(--text-tertiary);
  margin: 0;
}

.zone-name {
  font-size: clamp(18px, 2vw, 32px);
  color: var(--text-tertiary);
  margin: 0;
  margin-top: 0.5em;
  opacity: 0.7;
}

/* Mobile adjustments */
@media (max-width: 899px) {
  .content {
    justify-content: center;
  }

  .metadata-column {
    text-align: center;
    padding-right: 0;
  }

  .artist,
  .title,
  .album {
    max-width: 100%;
  }

  .track-info {
    align-items: center;
  }

  .no-playback {
    text-align: center;
  }
}
</style>
