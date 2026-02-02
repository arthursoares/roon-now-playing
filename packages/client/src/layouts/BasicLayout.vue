<script setup lang="ts">
import { computed } from 'vue';
import type { Track, PlaybackState, BackgroundType } from '@roon-screen-cover/shared';
import ProgressBar from '../components/ProgressBar.vue';
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
const { colors } = useColorExtraction(artworkUrlRef);

// Only support basic backgrounds for legacy compatibility
const backgroundColor = computed(() => {
  switch (props.background) {
    case 'white':
      return '#ffffff';
    case 'dominant':
      return colors.value.background || '#000000';
    case 'black':
    default:
      return '#000000';
  }
});

const textColor = computed(() => {
  if (props.background === 'white') return '#000000';
  if (props.background === 'dominant' && colors.value.mode === 'light') return '#000000';
  return '#ffffff';
});

const secondaryTextColor = computed(() => {
  if (props.background === 'white') return 'rgba(0, 0, 0, 0.7)';
  if (props.background === 'dominant' && colors.value.mode === 'light') return 'rgba(0, 0, 0, 0.7)';
  return 'rgba(255, 255, 255, 0.7)';
});
</script>

<template>
  <div
    class="basic-layout"
    :style="{
      backgroundColor: backgroundColor,
      color: textColor,
      '--text-secondary': secondaryTextColor,
      '--progress-bar-bg': props.background === 'white' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)',
      '--progress-bar-fill': textColor,
    }"
  >
    <div class="content">
      <!-- Artwork -->
      <div class="artwork-wrapper">
        <div class="artwork-inner">
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
      </div>

      <!-- Track Info -->
      <div class="info">
        <div v-if="track" class="track-info">
          <h1 class="title">{{ track.title }}</h1>
          <p class="artist">{{ track.artist }}</p>
          <p class="album">{{ track.album }}</p>
        </div>
        <div v-else class="no-playback">
          <p>No playback</p>
          <p class="zone-hint">{{ zoneName }}</p>
        </div>

        <!-- Progress Bar -->
        <div v-if="track" class="progress-section">
          <ProgressBar :progress="progress" :current-time="currentTime" :duration="duration" />
          <div class="time-display">
            <span>{{ currentTime }}</span>
            <span>{{ duration }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Base layout - no CSS gap, no aspect-ratio, no clamp() */
.basic-layout {
  width: 100%;
  height: 100%;
  display: -webkit-box;
  display: -webkit-flex;
  display: flex;
  -webkit-box-align: center;
  -webkit-align-items: center;
  align-items: center;
  -webkit-box-pack: center;
  -webkit-justify-content: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
  overflow: hidden;
}

.content {
  display: -webkit-box;
  display: -webkit-flex;
  display: flex;
  -webkit-box-orient: vertical;
  -webkit-box-direction: normal;
  -webkit-flex-direction: column;
  flex-direction: column;
  -webkit-box-align: center;
  -webkit-align-items: center;
  align-items: center;
  width: 100%;
  max-width: 800px;
  height: 100%;
  max-height: 100%;
}

/* Artwork - using padding-bottom hack for aspect ratio */
.artwork-wrapper {
  width: 100%;
  max-width: 400px;
  -webkit-flex-shrink: 0;
  flex-shrink: 0;
}

.artwork-inner {
  position: relative;
  width: 100%;
  padding-bottom: 100%; /* 1:1 aspect ratio */
}

.artwork {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  border-radius: 8px;
}

.artwork-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: -webkit-box;
  display: -webkit-flex;
  display: flex;
  -webkit-box-align: center;
  -webkit-align-items: center;
  align-items: center;
  -webkit-box-pack: center;
  -webkit-justify-content: center;
  justify-content: center;
  background: rgba(128, 128, 128, 0.2);
  border-radius: 8px;
}

.artwork-placeholder svg {
  width: 30%;
  height: 30%;
  opacity: 0.5;
}

/* Track info - using margins instead of gap */
.info {
  width: 100%;
  text-align: center;
  margin-top: 1.5rem;
  -webkit-flex-shrink: 1;
  flex-shrink: 1;
  min-height: 0;
  overflow: hidden;
}

.track-info > * + * {
  margin-top: 0.25rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist {
  font-size: 1.125rem;
  margin: 0;
  margin-top: 0.25rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album {
  font-size: 1rem;
  margin: 0;
  margin-top: 0.25rem;
  color: var(--text-secondary);
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-playback {
  font-size: 1.25rem;
  opacity: 0.6;
}

.no-playback p {
  margin: 0;
}

.no-playback p + p {
  margin-top: 0.5rem;
}

.zone-hint {
  font-size: 1rem;
  opacity: 0.8;
}

/* Progress section */
.progress-section {
  width: 100%;
  max-width: 400px;
  margin-top: 1.5rem;
  margin-left: auto;
  margin-right: auto;
}

.time-display {
  display: -webkit-box;
  display: -webkit-flex;
  display: flex;
  -webkit-box-pack: justify;
  -webkit-justify-content: space-between;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
}

/* Landscape orientation */
@media (orientation: landscape) {
  .content {
    -webkit-box-orient: horizontal;
    -webkit-box-direction: normal;
    -webkit-flex-direction: row;
    flex-direction: row;
    -webkit-box-align: center;
    -webkit-align-items: center;
    align-items: center;
    max-width: 1200px;
  }

  .artwork-wrapper {
    width: 40%;
    max-width: none;
    height: 80%;
    max-height: 500px;
  }

  .artwork-inner {
    height: 100%;
    padding-bottom: 0;
  }

  .artwork,
  .artwork-placeholder {
    height: 100%;
    width: auto;
    max-width: 100%;
  }

  .artwork {
    position: relative;
  }

  .artwork-placeholder {
    position: relative;
    aspect-ratio: 1;
  }

  .info {
    width: 50%;
    margin-top: 0;
    margin-left: 2rem;
    text-align: left;
  }

  .progress-section {
    max-width: none;
    margin-left: 0;
  }

  .title {
    font-size: 2rem;
  }

  .artist {
    font-size: 1.25rem;
  }

  .album {
    font-size: 1.125rem;
  }
}

/* Small screens */
@media (max-width: 480px) {
  .basic-layout {
    padding: 1rem;
  }

  .artwork-wrapper {
    max-width: 280px;
  }

  .title {
    font-size: 1.25rem;
  }

  .artist {
    font-size: 1rem;
  }

  .album {
    font-size: 0.875rem;
  }
}

/* Large screens */
@media (min-width: 1200px) and (orientation: landscape) {
  .title {
    font-size: 2.5rem;
  }

  .artist {
    font-size: 1.5rem;
  }

  .album {
    font-size: 1.25rem;
  }
}
</style>
