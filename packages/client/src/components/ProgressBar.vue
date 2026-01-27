<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  progress: number;
  currentTime: string;
  duration: string;
  showTime?: boolean;
}>();

const progressStyle = computed(() => ({
  width: `${props.progress}%`,
}));
</script>

<template>
  <div class="progress-bar-container">
    <div v-if="showTime" class="time-display">
      <span class="current">{{ currentTime }}</span>
      <span class="duration">{{ duration }}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" :style="progressStyle"></div>
    </div>
  </div>
</template>

<style scoped>
.progress-bar-container {
  width: 100%;
}

.time-display {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: var(--progress-time-size, 0.875rem);
  color: var(--text-tertiary, rgba(255, 255, 255, 0.7));
  font-variant-numeric: tabular-nums;
}

.progress-bar {
  height: var(--progress-bar-height, 4px);
  background: var(--progress-bar-bg, rgba(255, 255, 255, 0.2));
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--progress-bar-fill, rgba(255, 255, 255, 0.9));
  border-radius: 2px;
  transition: width 0.1s linear;
}
</style>
