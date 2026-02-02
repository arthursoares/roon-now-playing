<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
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

// Refs for height matching and overflow detection
const artworkWrapperRef = ref<HTMLDivElement | null>(null);
const factsColumnRef = ref<HTMLDivElement | null>(null);
const factTextRef = ref<HTMLParagraphElement | null>(null);
const factContainerRef = ref<HTMLDivElement | null>(null);
const needsScroll = ref(false);
const scrollDuration = ref(12);
const factsColumnMaxHeight = ref<string | null>(null);

function updateLayout() {
  nextTick(() => {
    // Match facts column height to artwork height
    if (artworkWrapperRef.value && factsColumnRef.value) {
      const artworkHeight = artworkWrapperRef.value.offsetHeight;
      if (artworkHeight > 0) {
        factsColumnMaxHeight.value = `${artworkHeight}px`;
      }
    }

    // Check for text overflow after height is set
    setTimeout(() => {
      if (factTextRef.value && factContainerRef.value) {
        const textHeight = factTextRef.value.scrollHeight;
        const containerHeight = factContainerRef.value.clientHeight;
        needsScroll.value = textHeight > containerHeight + 5;
        if (needsScroll.value) {
          const overflowAmount = textHeight - containerHeight;
          scrollDuration.value = Math.max(10, Math.min(25, 10 + overflowAmount / 20));
        }
      } else {
        needsScroll.value = false;
      }
    }, 50);
  });
}

// Handler for when artwork image loads
function onArtworkLoad() {
  updateLayout();
}

watch(currentFact, updateLayout);
watch(() => props.track, updateLayout);
watch(() => props.artworkUrl, () => {
  // Reset height when artwork changes, will be recalculated after image loads
  factsColumnMaxHeight.value = null;
});

// ResizeObserver for reliable height tracking
let resizeObserver: ResizeObserver | null = null;

function setupResizeObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (typeof ResizeObserver !== 'undefined' && artworkWrapperRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateLayout();
    });
    resizeObserver.observe(artworkWrapperRef.value);
  }
}

onMounted(() => {
  // Initial layout with delay to ensure DOM is ready
  setTimeout(updateLayout, 100);
  // Additional delayed update for slower renders
  setTimeout(updateLayout, 300);

  window.addEventListener('resize', updateLayout);

  // Set up ResizeObserver after next tick to ensure ref is available
  nextTick(() => {
    setupResizeObserver();
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', updateLayout);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

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
          <div ref="artworkWrapperRef" class="artwork-wrapper">
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
              @load="onArtworkLoad"
            />
            <div v-else class="artwork-placeholder">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- Right column: Facts + Metadata -->
        <div ref="factsColumnRef" class="facts-column" :style="factsColumnMaxHeight ? { height: factsColumnMaxHeight } : {}">
          <!-- Facts Area (constrained height with auto-scroll) -->
          <div ref="factContainerRef" class="facts-area">
            <div v-if="!track" class="no-playback">
              <p class="no-playback-text">No playback</p>
              <p class="zone-hint">{{ zoneName }}</p>
            </div>

            <template v-else>
              <p v-if="isLoading" class="loading-hint">Loading facts...</p>
              <p
                v-else-if="currentFact"
                ref="factTextRef"
                class="fact-text"
                :class="{ 'fact-text--scrolling': needsScroll }"
                :style="needsScroll ? { '--scroll-duration': scrollDuration + 's' } : {}"
              >{{ currentFact }}</p>
              <p v-else-if="error && error.type === 'no-key'" class="error-message">
                Configure API key in <a href="/admin">Admin Panel</a>
              </p>
              <p v-else-if="error" class="error-message">{{ error.message }}</p>

              <!-- Dot indicators -->
              <div v-if="facts.length > 1" class="fact-dots">
                <span
                  v-for="(_, index) in facts"
                  :key="index"
                  class="dot"
                  :class="{ active: index === currentFactIndex }"
                />
              </div>
            </template>
          </div>

          <!-- Metadata (always visible) -->
          <div v-if="track" class="metadata">
            <p class="title">{{ track.title }}</p>
            <p class="artist-album">{{ track.artist }} · {{ track.album }}</p>
          </div>

          <!-- Bottom section (fixed position) -->
          <div class="bottom-section">
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
  </DynamicBackground>

  <div v-else class="facts-columns-layout" :style="backgroundStyle">
    <div class="safe-zone">
      <div class="content">
        <!-- Left column: Artwork -->
        <div class="artwork-column">
          <div ref="artworkWrapperRef" class="artwork-wrapper">
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
              @load="onArtworkLoad"
            />
            <div v-else class="artwork-placeholder">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- Right column: Facts + Metadata -->
        <div ref="factsColumnRef" class="facts-column" :style="factsColumnMaxHeight ? { height: factsColumnMaxHeight } : {}">
          <!-- Facts Area (constrained height with auto-scroll) -->
          <div ref="factContainerRef" class="facts-area">
            <div v-if="!track" class="no-playback">
              <p class="no-playback-text">No playback</p>
              <p class="zone-hint">{{ zoneName }}</p>
            </div>

            <template v-else>
              <p v-if="isLoading" class="loading-hint">Loading facts...</p>
              <p
                v-else-if="currentFact"
                ref="factTextRef"
                class="fact-text"
                :class="{ 'fact-text--scrolling': needsScroll }"
                :style="needsScroll ? { '--scroll-duration': scrollDuration + 's' } : {}"
              >{{ currentFact }}</p>
              <p v-else-if="error && error.type === 'no-key'" class="error-message">
                Configure API key in <a href="/admin">Admin Panel</a>
              </p>
              <p v-else-if="error" class="error-message">{{ error.message }}</p>

              <!-- Dot indicators -->
              <div v-if="facts.length > 1" class="fact-dots">
                <span
                  v-for="(_, index) in facts"
                  :key="index"
                  class="dot"
                  :class="{ active: index === currentFactIndex }"
                />
              </div>
            </template>
          </div>

          <!-- Metadata (always visible) -->
          <div v-if="track" class="metadata">
            <p class="title">{{ track.title }}</p>
            <p class="artist-album">{{ track.artist }} · {{ track.album }}</p>
          </div>

          <!-- Bottom section (fixed position) -->
          <div class="bottom-section">
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
.facts-columns-layout {
  /* Fact text (main content) */
  --font-fact: clamp(22px, 3vw, 72px);
  --line-height-fact: 1.2;

  /* Track metadata */
  --font-title: clamp(18px, 2.2vw, 52px);
  --line-height-title: 1.1;
  --font-artist-album: clamp(14px, 1.6vw, 38px);
  --line-height-artist-album: 1.15;

  /* Secondary text */
  --font-zone: clamp(14px, 1.5vw, 36px);
  --font-loading: clamp(18px, 2vw, 48px);
  --font-error: clamp(16px, 1.8vw, 42px);

  /* No playback state */
  --font-no-playback: clamp(24px, 3vw, 72px);
  --font-zone-hint: clamp(16px, 2vw, 48px);

  /* Base styles */
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
    align-items: center; /* Center both columns vertically */
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
    max-height: 100%; /* Don't exceed container height */
    flex: 0 0 55%;
  }
}

.artwork-wrapper {
  position: relative;
  width: 100%;
  max-width: 100%; /* Don't exceed column width */
  max-height: 100%; /* Don't exceed available height */
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
  justify-content: space-between;
  min-width: 0;
  min-height: 0;
  padding-right: 2.5%;
  overflow: hidden;
  box-sizing: border-box;
}

@media (min-width: 900px) {
  .facts-column {
    flex: 0 0 40%;
    /* Height is set by JS to match artwork height */
  }
}

/* Facts area - constrained height with overflow scroll */
.facts-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0; /* Allow flex shrink */
  max-height: 100%;
  overflow: hidden;
  position: relative;
}

.fact-text {
  font-size: var(--font-fact);
  font-weight: 400;
  line-height: var(--line-height-fact);
  margin: 0;
  color: var(--text-color);
  animation: fadeIn 0.5s ease-out;

  /* Typography improvements */
  hyphens: auto;
  -webkit-hyphens: auto;
  hyphenate-limit-chars: 8 4 4;
  word-spacing: 0.02em;
  letter-spacing: -0.01em;
  text-wrap: pretty; /* Better line breaking */
  overflow-wrap: break-word;
  text-rendering: optimizeLegibility;
}

/* Auto-scrolling animation for overflowing text */
.fact-text--scrolling {
  animation: factScroll var(--scroll-duration, 12s) ease-in-out infinite;
}

@keyframes factScroll {
  0%, 15% {
    transform: translateY(0); /* Hold at top */
  }
  40%, 60% {
    transform: translateY(calc(-100% + 4em)); /* Scroll to show end, hold */
  }
  85%, 100% {
    transform: translateY(0); /* Return to top, hold */
  }
}

.loading-hint {
  font-size: var(--font-loading);
  color: var(--text-tertiary);
  margin: 0;
}

.error-message {
  font-size: var(--font-error);
  color: var(--text-tertiary);
  margin: 0;
}

.error-message a {
  color: var(--text-secondary);
  text-decoration: underline;
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

/* Metadata - always visible, secondary */
.metadata {
  margin-bottom: 1.5rem;
}

.metadata .title {
  font-size: var(--font-title);
  font-weight: 600;
  line-height: var(--line-height-title);
  margin: 0 0 0.2em 0;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadata .artist-album {
  font-size: var(--font-artist-album);
  font-weight: 400;
  line-height: var(--line-height-artist-album);
  margin: 0;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Bottom section - fixed position */
.bottom-section {
  flex-shrink: 0;
}

.progress-container {
  margin-bottom: 1rem;
}

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
  font-size: var(--font-no-playback);
  color: var(--text-tertiary);
  margin: 0;
}

.zone-hint {
  font-size: var(--font-zone-hint);
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
