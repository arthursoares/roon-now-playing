<script setup lang="ts">
import { watch } from 'vue';
import { useWebSocket } from './composables/useWebSocket';

const { state } = useWebSocket();

watch(
  () => state.value.displaySettings?.fontScale,
  (scale) => {
    if (scale) {
      document.documentElement.style.setProperty('--font-scale', String(scale));
    }
  },
  { immediate: true }
);
</script>

<template>
  <router-view />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
}
</style>
