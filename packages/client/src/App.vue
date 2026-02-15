<script setup lang="ts">
import { useWebSocket } from './composables/useWebSocket';

// Initialize WebSocket for connection state
// Note: Font scale is applied per-route (e.g., NowPlayingView handles it)
const { state } = useWebSocket();
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
