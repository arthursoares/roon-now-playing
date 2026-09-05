<script setup lang="ts">
import { computed } from 'vue';
import type { Zone, NowPlaying as NowPlayingType, LayoutType, BackgroundType, RecentAlbum } from '@roon-screen-cover/shared';
import { useNowPlaying } from '../composables/useNowPlaying';
import MinimalLayout from '../layouts/MinimalLayout.vue';
import DetailedLayout from '../layouts/DetailedLayout.vue';
import FullscreenLayout from '../layouts/FullscreenLayout.vue';
import AmbientLayout from '../layouts/AmbientLayout.vue';
import CoverLayout from '../layouts/CoverLayout.vue';
import FactsColumnsLayout from '../layouts/FactsColumnsLayout.vue';
import FactsOverlayLayout from '../layouts/FactsOverlayLayout.vue';
import FactsCarouselLayout from '../layouts/FactsCarouselLayout.vue';
import BasicLayout from '../layouts/BasicLayout.vue';
import AlbumWallLayout from '../layouts/AlbumWallLayout.vue';

const props = withDefaults(defineProps<{
  nowPlaying: NowPlayingType | null;
  albumHistory?: RecentAlbum[];
  zone: Zone;
  layout: LayoutType;
  background: BackgroundType;
}>(), {
  albumHistory: () => [],
});

const emit = defineEmits<{
  'change-zone': [];
  'cycle-layout': [];
}>();

const {
  track,
  state,
  isPlaying,
  progress,
  currentTimeFormatted,
  durationFormatted,
  artworkUrl,
} = useNowPlaying(() => props.nowPlaying);

const layoutComponent = computed(() => {
  switch (props.layout) {
    case 'minimal':
      return MinimalLayout;
    case 'fullscreen':
      return FullscreenLayout;
    case 'ambient':
      return AmbientLayout;
    case 'cover':
      return CoverLayout;
    case 'facts-columns':
      return FactsColumnsLayout;
    case 'facts-overlay':
      return FactsOverlayLayout;
    case 'facts-carousel':
      return FactsCarouselLayout;
    case 'basic':
      return BasicLayout;
    case 'album-wall':
      return AlbumWallLayout;
    default:
      return DetailedLayout;
  }
});

function handleClick(): void {
  emit('cycle-layout');
}

function handleDoubleClick(): void {
  emit('change-zone');
}
</script>

<template>
  <div
    class="now-playing"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <component
      :is="layoutComponent"
      :track="track"
      :state="state"
      :is-playing="isPlaying"
      :progress="progress"
      :current-time="currentTimeFormatted"
      :duration="durationFormatted"
      :artwork-url="artworkUrl"
      :zone-name="zone.display_name"
      :background="background"
      v-bind="layout === 'album-wall' ? { albumHistory } : {}"
    />
  </div>
</template>

<style scoped>
.now-playing {
  width: 100%;
  height: 100%;
  cursor: pointer;
  user-select: none;
}
</style>
