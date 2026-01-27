<script setup lang="ts">
import { computed } from 'vue';
import type { Zone, NowPlaying as NowPlayingType, LayoutType } from '@roon-screen-cover/shared';
import { useNowPlaying } from '../composables/useNowPlaying';
import MinimalLayout from '../layouts/MinimalLayout.vue';
import DetailedLayout from '../layouts/DetailedLayout.vue';
import FullscreenLayout from '../layouts/FullscreenLayout.vue';
import AmbientLayout from '../layouts/AmbientLayout.vue';

const props = defineProps<{
  nowPlaying: NowPlayingType | null;
  zone: Zone;
  layout: LayoutType;
}>();

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
