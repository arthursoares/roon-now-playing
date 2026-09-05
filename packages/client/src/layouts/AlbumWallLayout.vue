<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type {
  BackgroundType,
  PlaybackState,
  RecentAlbum,
  Track,
} from '@roon-screen-cover/shared';
import { ALBUM_HISTORY_LIMIT, getAlbumId } from '@roon-screen-cover/shared';
import DynamicBackground from '../components/DynamicBackground.vue';
import ProgressBar from '../components/ProgressBar.vue';
import { useBackgroundStyle } from '../composables/useBackgroundStyle';
import { useColorExtraction } from '../composables/useColorExtraction';
import { isDynamicBackground } from '../utils/backgrounds';
import { calculateAlbumGalleryGeometry } from '../utils/albumGallery';

const props = withDefaults(defineProps<{
  track: Track | null;
  state: PlaybackState;
  isPlaying: boolean;
  progress: number;
  currentTime: string;
  duration: string;
  artworkUrl: string | null;
  zoneName: string;
  background: BackgroundType;
  albumHistory?: RecentAlbum[];
  galleryOnly?: boolean;
}>(), {
  albumHistory: () => [],
  galleryOnly: false,
});

const backgroundRef = computed(() => props.background);
const artworkUrlRef = computed(() => props.galleryOnly ? null : props.artworkUrl);
const { colors, vibrantGradient, palette } = useColorExtraction(artworkUrlRef);
const { style: backgroundStyle } = useBackgroundStyle(backgroundRef, colors, vibrantGradient);
const usesDynamicBackground = computed(() => !props.galleryOnly && isDynamicBackground(props.background));
const rootComponent = computed(() => usesDynamicBackground.value ? DynamicBackground : 'div');
const rootBindings = computed(() => usesDynamicBackground.value
  ? {
      type: props.background,
      artworkUrl: props.artworkUrl,
      palette: palette.value,
      vibrantGradient: vibrantGradient.value,
      style: backgroundStyle.value,
    }
  : { style: backgroundStyle.value }
);
const contentContrastStyle = computed(() => usesDynamicBackground.value
  ? {
      '--text-color': '#ffffff',
      '--text-secondary': 'rgba(255, 255, 255, 0.94)',
      '--text-tertiary': 'rgba(255, 255, 255, 0.88)',
      '--progress-bar-bg': 'rgba(255, 255, 255, 0.28)',
      '--progress-bar-fill': '#ffffff',
    }
  : undefined
);

const currentAlbumId = computed(() => props.track
  ? getAlbumId(props.track.artist, props.track.album)
  : null
);

const previousAlbums = computed(() => props.albumHistory.filter((album) =>
  album.id !== currentAlbumId.value
));
const galleryAlbums = computed<RecentAlbum[]>(() => {
  const seenAlbumIds = new Set<string>();
  const albums = props.albumHistory.filter((album) => {
    if (seenAlbumIds.has(album.id)) return false;
    seenAlbumIds.add(album.id);
    return true;
  });
  if (props.track && currentAlbumId.value && !albums.some((album) => album.id === currentAlbumId.value)) {
    albums.unshift({
      id: currentAlbumId.value,
      artist: props.track.artist,
      album: props.track.album,
      artwork_key: props.track.artwork_key,
      last_played_at: Date.now(),
    });
  }
  return albums.slice(0, ALBUM_HISTORY_LIMIT);
});
const galleryViewportRef = ref<HTMLElement | null>(null);
const galleryViewportSize = ref({
  width: typeof window === 'undefined' ? 1 : Math.max(1, window.innerWidth),
  height: typeof window === 'undefined' ? 1 : Math.max(1, window.innerHeight),
});
const galleryGeometry = computed(() => calculateAlbumGalleryGeometry(
  galleryAlbums.value.length,
  galleryViewportSize.value.width,
  galleryViewportSize.value.height
));
const galleryRows = computed(() => {
  let offset = 0;
  return galleryGeometry.value.rowLengths.map((length) => {
    const row = galleryAlbums.value.slice(offset, offset + length);
    offset += length;
    return row;
  });
});
const galleryCanvasStyle = computed(() => ({
  width: `${galleryGeometry.value.canvasWidth}px`,
  height: `${galleryGeometry.value.canvasHeight}px`,
}));

let galleryResizeObserver: ResizeObserver | null = null;

function updateGalleryViewportSize(): void {
  const viewport = galleryViewportRef.value;
  if (!viewport) return;
  galleryViewportSize.value = {
    width: Math.max(1, viewport.clientWidth || window.innerWidth),
    height: Math.max(1, viewport.clientHeight || window.innerHeight),
  };
}

watch(galleryViewportRef, (viewport) => {
  galleryResizeObserver?.disconnect();
  galleryResizeObserver = null;
  if (!viewport) return;
  updateGalleryViewportSize();
  if (typeof ResizeObserver !== 'undefined') {
    galleryResizeObserver = new ResizeObserver(updateGalleryViewportSize);
    galleryResizeObserver.observe(viewport);
  }
}, { flush: 'post' });

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', updateGalleryViewportSize);
  }
});

onUnmounted(() => {
  galleryResizeObserver?.disconnect();
  galleryResizeObserver = null;
  window.removeEventListener('resize', updateGalleryViewportSize);
});

const failedArtworkKeys = ref<Map<string, string | null>>(new Map());
const heroArtworkFailed = ref(false);

watch(artworkUrlRef, () => {
  heroArtworkFailed.value = false;
});

function recentArtworkUrl(album: RecentAlbum): string | null {
  return album.artwork_key ? `/api/artwork/${album.artwork_key}` : null;
}

function markArtworkFailed(album: RecentAlbum): void {
  failedArtworkKeys.value = new Map(failedArtworkKeys.value).set(album.id, album.artwork_key);
}
</script>

<template>
  <component
    :is="rootComponent"
    v-bind="rootBindings"
    :class="galleryOnly ? 'album-gallery-layout' : 'album-wall-layout'"
  >
    <main
      ref="galleryViewportRef"
      class="album-wall-content"
      :class="{
        'dynamic-contrast': usesDynamicBackground && (!galleryOnly || galleryAlbums.length === 0),
        'album-gallery-content': galleryOnly,
      }"
      :style="contentContrastStyle"
    >
      <template v-if="galleryOnly">
        <section
          v-if="galleryAlbums.length"
          class="gallery-canvas"
          :style="galleryCanvasStyle"
          aria-label="Album gallery"
        >
          <div v-for="(row, rowIndex) in galleryRows" :key="rowIndex" class="gallery-row">
            <article
              v-for="album in row"
              :key="album.id"
              class="gallery-card"
              :title="`${album.album} — ${album.artist}`"
              :aria-label="`${album.album} by ${album.artist}`"
              :aria-current="album.id === currentAlbumId ? 'true' : undefined"
            >
              <div class="album-cover-frame">
                <img
                  v-if="recentArtworkUrl(album) && failedArtworkKeys.get(album.id) !== album.artwork_key"
                  :src="recentArtworkUrl(album)!"
                  :alt="`${album.album} by ${album.artist}`"
                  class="album-cover artwork"
                  loading="eager"
                  @error="markArtworkFailed(album)"
                />
                <div v-else class="cover-placeholder" aria-hidden="true"><span>♪</span></div>
              </div>
            </article>
          </div>
        </section>

        <section v-else class="empty-history gallery-empty" aria-label="Album gallery">
          <span class="empty-mark">◎</span>
          <p>Play an album to begin your gallery.</p>
        </section>
      </template>

      <section v-if="!galleryOnly" class="hero" aria-label="Now playing">
        <div class="hero-artwork-frame">
          <img
            v-if="artworkUrl && !heroArtworkFailed"
            :src="artworkUrl"
            :alt="track?.album ? `${track.album} album cover` : 'Current album cover'"
            class="hero-artwork artwork"
            @error="heroArtworkFailed = true"
          />
          <div v-else class="cover-placeholder hero-placeholder" aria-hidden="true">
            <span>♪</span>
          </div>
        </div>

        <div class="now-playing-copy">
          <p class="eyebrow">{{ isPlaying ? 'Now playing' : state === 'paused' ? 'Paused' : 'Selected' }}</p>
          <template v-if="track">
            <h1 :title="track.title">{{ track.title }}</h1>
            <p class="artist" :title="track.artist">{{ track.artist }}</p>
            <p class="album" :title="track.album">{{ track.album }}</p>
            <ProgressBar
              class="progress"
              :progress="progress"
              :current-time="currentTime"
              :duration="duration"
              :show-time="true"
            />
          </template>
          <div v-else class="empty-hero">
            <h1>No music playing</h1>
            <p>Your recent albums will gather here as you listen.</p>
          </div>
          <p class="zone">{{ zoneName }}</p>
        </div>
      </section>

      <section v-if="!galleryOnly" class="history" aria-label="Recently played albums">
        <header>
          <p class="eyebrow">Recently played</p>
          <p v-if="previousAlbums.length" class="history-count">{{ previousAlbums.length }}</p>
        </header>

        <div v-if="previousAlbums.length" class="album-grid">
          <article
            v-for="album in previousAlbums"
            :key="album.id"
            class="album-card"
            :title="`${album.album} — ${album.artist}`"
          >
            <div class="album-cover-frame">
              <img
                v-if="recentArtworkUrl(album) && failedArtworkKeys.get(album.id) !== album.artwork_key"
                :src="recentArtworkUrl(album)!"
                :alt="`${album.album} by ${album.artist}`"
                class="album-cover"
                loading="eager"
                @error="markArtworkFailed(album)"
              />
              <div v-else class="cover-placeholder" aria-hidden="true"><span>♪</span></div>
            </div>
            <div class="album-copy">
              <p class="album-name">{{ album.album }}</p>
              <p class="album-artist">{{ album.artist }}</p>
            </div>
          </article>
        </div>

        <div v-else class="empty-history">
          <span class="empty-mark">◎</span>
          <p>{{ track ? 'More albums will appear as the music continues.' : 'Play an album to begin your wall.' }}</p>
        </div>
      </section>
    </main>
  </component>
</template>

<style scoped>
.album-wall-layout,
.album-gallery-layout {
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--text-color, #fff);
  transition: background 500ms ease-out;
}

.album-wall-content {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.9fr);
  padding: clamp(1.5rem, 3.4vw, 5rem);
  column-gap: clamp(2rem, 4vw, 6rem);
}

.album-wall-content.dynamic-contrast {
  background: rgba(0, 0, 0, 0.58);
}

.album-gallery-content {
  position: relative;
  display: block;
  padding: 0;
  overflow: hidden;
}

.gallery-canvas {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  flex-direction: column;
  transform: translate(-50%, -50%);
}

.gallery-row {
  width: 100%;
  display: flex;
  flex: 0 0 auto;
}

.gallery-card {
  min-width: 0;
  flex: 1 1 0;
  aspect-ratio: 1;
}

.gallery-card .album-cover-frame {
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  border-radius: 0;
  box-shadow: none;
}

.gallery-card .album-cover {
  object-fit: contain;
  background: #000;
}

.gallery-empty {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
}

.hero {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(16rem, 1.12fr) minmax(14rem, 0.88fr);
  align-items: center;
  gap: clamp(1.5rem, 3vw, 4.5rem);
}

.hero-artwork-frame,
.album-cover-frame {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  background: color-mix(in srgb, var(--text-color, #fff) 7%, transparent);
}

.hero-artwork-frame {
  width: min(100%, 66vh);
  justify-self: end;
  border-radius: clamp(0.5rem, 0.8vw, 1.25rem);
  box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.28);
}

.hero-artwork,
.album-cover {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.now-playing-copy {
  min-width: 0;
}

.eyebrow {
  margin: 0;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.6));
  font-size: calc(clamp(0.68rem, 0.7vw, 1rem) * var(--font-scale, 1));
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  margin: clamp(0.7rem, 1.4vw, 1.6rem) 0 0;
  font-size: calc(clamp(2rem, 3.3vw, 5.8rem) * var(--font-scale, 1));
  font-weight: 600;
  line-height: 0.98;
  letter-spacing: -0.04em;
  overflow-wrap: anywhere;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.artist,
.album,
.zone,
.album-name,
.album-artist,
.empty-hero p,
.empty-history p {
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist {
  margin: clamp(1rem, 1.6vw, 1.8rem) 0 0;
  color: var(--text-secondary, rgba(255, 255, 255, 0.8));
  font-size: calc(clamp(1.1rem, 1.55vw, 2.4rem) * var(--font-scale, 1));
  white-space: nowrap;
}

.album {
  margin: 0.3rem 0 0;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.6));
  font-size: calc(clamp(0.9rem, 1vw, 1.5rem) * var(--font-scale, 1));
  white-space: nowrap;
}

.progress {
  margin-top: clamp(1.5rem, 2.5vw, 3rem);
  --progress-bar-height: 3px;
}

.zone {
  margin: clamp(1.1rem, 1.7vw, 2rem) 0 0;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.6));
  font-size: calc(clamp(0.72rem, 0.75vw, 1.05rem) * var(--font-scale, 1));
  white-space: nowrap;
}

.empty-hero p {
  margin: 1rem 0 0;
  color: var(--text-secondary, rgba(255, 255, 255, 0.8));
  line-height: 1.5;
}

.history {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.history header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: clamp(1rem, 1.5vw, 2rem);
}

.history-count {
  margin: 0;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.6));
  font-variant-numeric: tabular-nums;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(0.8rem, 1.25vw, 1.8rem);
}

.album-card {
  min-width: 0;
  animation: album-enter 500ms ease-out both;
}

.album-card:nth-child(2n) { animation-delay: 40ms; }
.album-card:nth-child(3n) { animation-delay: 80ms; }

.album-cover-frame {
  border-radius: clamp(0.3rem, 0.5vw, 0.75rem);
  box-shadow: 0 0.7rem 1.8rem rgba(0, 0, 0, 0.18);
}

.album-copy {
  padding: clamp(0.45rem, 0.65vw, 0.8rem) 0.1rem 0;
}

.album-name,
.album-artist {
  margin: 0;
  white-space: nowrap;
}

.album-name {
  font-size: calc(clamp(0.72rem, 0.75vw, 2rem) * var(--font-scale, 1));
  font-weight: 550;
}

.album-artist {
  margin-top: 0.16rem;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.6));
  font-size: calc(clamp(0.64rem, 0.6vw, 1.5rem) * var(--font-scale, 1));
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
  background:
    radial-gradient(circle at 50% 50%, transparent 0 18%, currentColor 19% 20%, transparent 21%),
    linear-gradient(145deg, rgba(127, 127, 127, 0.12), rgba(127, 127, 127, 0.03));
}

.cover-placeholder span {
  font-size: clamp(1.4rem, 2.5vw, 4rem);
  opacity: 0.55;
}

.empty-history {
  min-height: 14rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  border: 1px solid color-mix(in srgb, var(--text-color, #fff) 12%, transparent);
  border-radius: 1rem;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.6));
  text-align: center;
}

.empty-mark {
  font-size: 2.5rem;
  opacity: 0.45;
}

.empty-history p {
  max-width: 20rem;
  margin: 1rem 0 0;
  line-height: 1.5;
}

@keyframes album-enter {
  from { opacity: 0; transform: translateY(0.75rem); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1050px), (max-aspect-ratio: 6/5) {
  .album-wall-content:not(.album-gallery-content) {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1.18fr) minmax(0, 0.82fr);
    row-gap: clamp(1.5rem, 3vh, 3rem);
    overflow-y: auto;
  }

  .hero {
    grid-template-columns: minmax(12rem, 0.9fr) minmax(12rem, 1.1fr);
  }

  .hero-artwork-frame {
    width: min(100%, 44vh);
  }

  .history { justify-content: start; }
  .album-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-aspect-ratio: 6/5) {
  .album-wall-content:not(.album-gallery-content) {
    grid-template-rows: minmax(0, 27vh) minmax(0, 1fr);
    row-gap: clamp(1rem, 2vh, 1.5rem);
    overflow: hidden;
  }

  .hero-artwork-frame {
    width: min(100%, 25vh);
  }

  .history {
    min-height: 0;
  }

  .history header {
    margin-bottom: clamp(0.6rem, 1vh, 0.9rem);
  }

  .album-grid {
    gap: clamp(0.5rem, 1.2vw, 0.8rem);
  }

  .album-copy {
    padding-top: clamp(0.3rem, 0.5vh, 0.5rem);
  }

}

@media (max-width: 620px) {
  .album-wall-content:not(.album-gallery-content) {
    display: block;
    padding: 1.25rem;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .hero-artwork-frame {
    width: min(100%, 48vh);
    align-self: center;
  }

  .now-playing-copy { text-align: center; }
  .history { margin-top: 2.5rem; }
  .album-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

}

@media (prefers-reduced-motion: reduce) {
  .album-wall-layout,
  .album-gallery-layout,
  .album-card {
    transition: none;
    animation: none;
  }
}
</style>
