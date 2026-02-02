<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import { useColorExtraction } from '../composables/useColorExtraction';
import { useBackgroundStyle } from '../composables/useBackgroundStyle';
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

const backgroundRef = computed(() => props.background);
const artworkUrlRef = computed(() => props.artworkUrl);
const { colors, vibrantGradient, palette, isTransitioning } = useColorExtraction(artworkUrlRef);
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

// Compute the effective color mode based on background type and extracted colors
const effectiveColorMode = computed(() => {
  if (props.background === 'white') return 'light';
  if (props.background === 'black') return 'dark';
  return colors.value.mode;
});

const ambientStyle = computed(() => {
  // CSS variables for ambient-specific styling (used by all background types)
  const cssVariables = {
    '--bg-color': colors.value.background,
    '--bg-edge': colors.value.backgroundEdge,
    '--shadow-color': colors.value.shadow,
    // Progress bar customization
    '--progress-bar-height': '6px',
    '--progress-time-size': 'clamp(14px, 1.5vw, 18px)',
    '--progress-bar-bg': effectiveColorMode.value === 'dark'
      ? 'rgba(255, 255, 255, 0.15)'
      : 'rgba(0, 0, 0, 0.15)',
    '--progress-bar-fill': effectiveColorMode.value === 'dark'
      ? 'rgba(255, 255, 255, 0.8)'
      : 'rgba(0, 0, 0, 0.6)',
  };

  // For new background types, DynamicBackground handles the background
  // We only provide CSS variables
  if (usesDynamicBackground.value) {
    return cssVariables;
  }

  // For original types, include the background styling
  const baseStyle = { ...backgroundStyle.value };

  // For ambient layout, use radial gradient when gradient-radial or dominant is selected
  if (props.background === 'gradient-radial' || props.background === 'dominant') {
    baseStyle.background = `radial-gradient(ellipse 120% 100% at 30% 50%, ${colors.value.background} 0%, ${colors.value.backgroundEdge} 100%)`;
  }

  return {
    ...baseStyle,
    ...cssVariables,
  };
});
</script>

<template>
  <DynamicBackground
    v-if="usesDynamicBackground"
    :type="background"
    :artwork-url="artworkUrl"
    :palette="palette"
    :vibrant-gradient="vibrantGradient"
    class="ambient-layout"
    :class="{ transitioning: isTransitioning }"
    :style="ambientStyle"
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
        </div>

        <!-- Right column: Metadata -->
        <div class="metadata-column">
          <div v-if="track" class="track-info">
            <h1 class="title">{{ track.title }}</h1>
            <p class="artist">{{ track.artist }}</p>
            <p class="album">{{ track.album }}</p>
          </div>
          <div v-else class="no-playback">
            <p class="no-playback-text">No playback</p>
            <p class="zone-hint">{{ zoneName }}</p>
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

  <div
    v-else
    class="ambient-layout"
    :class="{ transitioning: isTransitioning }"
    :style="ambientStyle"
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
        </div>

        <!-- Right column: Metadata -->
        <div class="metadata-column">
          <div v-if="track" class="track-info">
            <h1 class="title">{{ track.title }}</h1>
            <p class="artist">{{ track.artist }}</p>
            <p class="album">{{ track.album }}</p>
          </div>
          <div v-else class="no-playback">
            <p class="no-playback-text">No playback</p>
            <p class="zone-hint">{{ zoneName }}</p>
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
/*
 * ============================================
 * TYPOGRAPHY CONFIGURATION
 * Adjust these values to tweak font sizes and line heights.
 * Format: clamp(min, preferred, max)
 * ============================================
 */
.ambient-layout {
  /* Track metadata */
  --font-title: clamp(28px, 4.5vw, 56px);
  --line-height-title: 1.15;
  --font-artist: clamp(20px, 3vw, 40px);
  --line-height-artist: 1.2;
  --font-album: clamp(16px, 2vw, 28px);
  --line-height-album: 1.3;

  /* Secondary text */
  --font-zone: clamp(14px, 1.5vw, 20px);

  /* No playback state */
  --font-no-playback: clamp(24px, 3vw, 48px);
  --font-zone-hint: clamp(16px, 2vw, 28px);

  /* Base styles */
  width: 100%;
  height: 100%;
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
  margin-bottom: 2rem;
}

/* Typography - 10ft UI Scale, Title-first like Detailed */
.title {
  font-size: var(--font-title);
  font-weight: 600;
  line-height: var(--line-height-title);
  margin: 0;
  margin-bottom: 0.4em;
  color: var(--text-color);

  /* Two lines with ellipsis */
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.artist {
  font-size: var(--font-artist);
  font-weight: 400;
  line-height: var(--line-height-artist);
  margin: 0;
  margin-bottom: 0.2em;
  color: var(--text-secondary);

  /* Single line with ellipsis */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album {
  font-size: var(--font-album);
  font-weight: 400;
  line-height: var(--line-height-album);
  margin: 0;
  color: var(--text-tertiary);

  /* Single line with ellipsis */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Progress Bar */
.progress-container {
  margin-bottom: 2rem;
}

/* Zone Indicator */
.zone-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-tertiary);
  font-size: var(--font-zone);
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
  0%, 100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}

.paused-indicator {
  font-size: 1em;
  opacity: 0.8;
}

/* No playback state */
.no-playback {
  text-align: left;
}

.no-playback-text {
  font-size: var(--font-no-playback);
  color: var(--text-tertiary);
  margin: 0;
}

.zone-hint {
  font-size: var(--font-zone-hint);
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

  .title,
  .artist,
  .album {
    max-width: 100%;
  }

  .track-info {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .zone-indicator {
    justify-content: center;
  }

  .no-playback {
    text-align: center;
  }
}
</style>
